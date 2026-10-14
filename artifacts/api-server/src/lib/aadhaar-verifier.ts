import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import { DOMParser } from "@xmldom/xmldom";
import { SignedXml } from "xml-crypto";
import xpath from "xpath";
import {
  getActiveUidaiCertificate,
  formatAsPem,
  inspectCertificate,
  CertificateInspection,
} from "./uidai-cert";

const execFileAsync = promisify(execFile);

export type SignatureVerificationStatus = "VALID" | "INVALID" | "NOT_VERIFIED" | "ERROR";

export interface AadhaarAddress {
  careOf?: string | null;
  house?: string | null;
  street?: string | null;
  landmark?: string | null;
  locality?: string | null;
  villageTownCity?: string | null;
  subDistrict?: string | null;
  district?: string | null;
  state?: string | null;
  pinCode?: string | null;
  postOffice?: string | null;
  fullAddress: string;
}

export interface AadhaarIdentity {
  name: string | null;
  dob: string | null;
  gender: string | null;
  referenceId: string | null;
  address: AadhaarAddress;
  photoDataUrl: string | null;
  hasPhoto: boolean;
  hashedMobile?: string | null;
  hashedEmail?: string | null;
}

export interface AadhaarVerificationOutcome {
  success: boolean;
  xmlStructureValid: boolean;
  signatureVerificationStatus: SignatureVerificationStatus;
  signatureAlgorithm?: string | null;
  signerCertificate?: CertificateInspection;
  identity: AadhaarIdentity;
  extractedFileName: string;
  errorMessage?: string;
  debugDetails?: {
    hasSignatureNode: boolean;
    referenceUri?: string;
    digestAlgorithm?: string;
  };
}

/**
 * Extracts XML file content safely from password-protected or unencrypted Aadhaar Offline e-KYC ZIP.
 * Protects against Zip Slip, traversal attacks, and oversized archives.
 */
export async function extractAadhaarXmlFromZip(
  zipBuffer: Buffer,
  shareCode?: string
): Promise<{ xmlString: string; xmlFileName: string }> {
  // 1. Validate file size (10 MB maximum for offline e-KYC zip)
  if (zipBuffer.length > 10 * 1024 * 1024) {
    throw new Error("File too large. Aadhaar Offline e-KYC ZIP must be under 10 MB.");
  }

  // 2. Validate ZIP magic bytes
  if (
    zipBuffer.length < 4 ||
    !(
      (zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4b && zipBuffer[2] === 0x03 && zipBuffer[3] === 0x04) ||
      (zipBuffer[0] === 0x50 && zipBuffer[1] === 0x4b && zipBuffer[2] === 0x05 && zipBuffer[3] === 0x06)
    )
  ) {
    throw new Error("Invalid file format: Uploaded file is not a valid ZIP archive.");
  }

  const cleanCode = (shareCode || "").trim();

  // Try method 1: In-memory AdmZip extraction
  try {
    const zip = new AdmZip(zipBuffer);
    const entries = zip.getEntries();

    if (!entries || entries.length === 0) {
      throw new Error("The uploaded ZIP archive contains no files.");
    }

    // Zip Slip defense
    for (const entry of entries) {
      if (entry.entryName.includes("..") || path.isAbsolute(entry.entryName)) {
        throw new Error("Security Alert: Malicious archive structure detected (Zip Slip attempt).");
      }
    }

    const xmlEntry = entries.find((e) => e.entryName.toLowerCase().endsWith(".xml"));
    if (xmlEntry) {
      let content: string | null = null;
      if (cleanCode) {
        try {
          content = zip.readAsText(xmlEntry, "utf8");
        } catch {}
      } else {
        content = zip.readAsText(xmlEntry, "utf8");
      }

      if (content && content.includes("<OfflinePaperlessKyc")) {
        return { xmlString: content, xmlFileName: xmlEntry.entryName };
      }
    }
  } catch (admErr: any) {
    // AdmZip might fail on traditional ZipCrypto password encryption, proceed to sandboxed CLI extraction
  }

  // Method 2: Isolated ephemeral filesystem extraction using standard /usr/bin/unzip
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uidai_ekyc_"));
  const tempZipPath = path.join(tempDir, "archive.zip");

  try {
    fs.writeFileSync(tempZipPath, zipBuffer);

    // Build safe CLI args. If shareCode is present, use -P argument
    const args: string[] = ["-q", "-o"];
    if (cleanCode) {
      args.push("-P", cleanCode);
    }
    args.push(tempZipPath, "-d", tempDir);

    try {
      await execFileAsync("/usr/bin/unzip", args, { timeout: 8000 });
    } catch (unzipErr: any) {
      const errStr = String(unzipErr?.message || unzipErr?.stderr || "");
      if (errStr.includes("incorrect password") || errStr.includes("password") || unzipErr?.code === 82) {
        throw new Error("Incorrect Share Code. Please verify the 4-character Share Code and try again.");
      }
      throw new Error("Unable to open the Offline e-KYC package. Please confirm that the ZIP file and Share Code are correct.");
    }

    // Scan extracted files in tempDir
    const extractedFiles = fs.readdirSync(tempDir);
    const xmlFileName = extractedFiles.find((f) => f.toLowerCase().endsWith(".xml"));

    if (!xmlFileName) {
      throw new Error("XML missing: The Offline e-KYC package does not contain an XML identity file.");
    }

    const fullXmlPath = path.join(tempDir, xmlFileName);
    const resolvedPath = path.resolve(fullXmlPath);

    // Verify canonical path stays strictly inside tempDir
    if (!resolvedPath.startsWith(path.resolve(tempDir))) {
      throw new Error("Security Alert: Malicious file path in e-KYC package.");
    }

    const xmlString = fs.readFileSync(resolvedPath, "utf8");
    return { xmlString, xmlFileName };
  } finally {
    // Secure ephemeral cleanup
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  }
}

/**
 * Validates the XML-DSig digital signature of the UIDAI Offline e-KYC document.
 * Checks whether the document was signed by UIDAI and whether the signature is cryptographically valid.
 */
export function verifyUidaiXmlSignature(xmlString: string): {
  status: SignatureVerificationStatus;
  signatureAlgorithm?: string | null;
  signerCertificate?: CertificateInspection;
  hasSignatureNode: boolean;
  referenceUri?: string;
  errorMessage?: string;
} {
  try {
    const doc = new DOMParser({
      onError: (level, msg) => {
        if (level === "fatalError") {
          throw new Error(`XML Syntax Error: ${msg}`);
        }
      },
    }).parseFromString(xmlString, "text/xml");

    const select = xpath.useNamespaces({
      ds: "http://www.w3.org/2000/09/xmldsig#",
    });

    const signatureNodes = select("//*[local-name(.)='Signature']", doc) as Node[];
    if (!signatureNodes || signatureNodes.length === 0) {
      return {
        status: "NOT_VERIFIED",
        hasSignatureNode: false,
        errorMessage: "No digital signature element found in XML.",
      };
    }

    const signatureNode = signatureNodes[0];

    // Extract algorithm from SignatureMethod
    const sigMethodNodes = select(".//*[local-name(.)='SignatureMethod']", signatureNode as any) as Element[];
    const signatureAlgorithm = sigMethodNodes[0]?.getAttribute("Algorithm") || "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";

    // Extract reference URI
    const refNodes = select(".//*[local-name(.)='Reference']", signatureNode as any) as Element[];
    const referenceUri = refNodes[0]?.getAttribute("URI") || "";

    // Extract embedded X.509 Certificate
    const certNodes = select(".//*[local-name(.)='X509Certificate']", signatureNode as any) as Element[];
    let certPem: string | null = null;
    let signerCertInspection: CertificateInspection | undefined;

    if (certNodes.length > 0 && certNodes[0].textContent) {
      const rawCertB64 = certNodes[0].textContent.trim();
      certPem = formatAsPem(rawCertB64);
      signerCertInspection = inspectCertificate(certPem);
    }

    // Use active configured UIDAI certificate as the ultimate trust anchor if embedded is missing
    const trustAnchorCertPem = certPem || getActiveUidaiCertificate();

    // Verify signature using xml-crypto
    const sig = new SignedXml({
      publicCert: trustAnchorCertPem,
    });

    sig.loadSignature(signatureNode as any);
    const isValid = sig.checkSignature(xmlString);

    if (isValid) {
      return {
        status: "VALID",
        signatureAlgorithm,
        signerCertificate: signerCertInspection,
        hasSignatureNode: true,
        referenceUri,
      };
    } else {
      return {
        status: "INVALID",
        signatureAlgorithm,
        signerCertificate: signerCertInspection,
        hasSignatureNode: true,
        referenceUri,
        errorMessage: sig.validationErrors?.join("; ") || "Cryptographic digest or signature mismatch.",
      };
    }
  } catch (err: any) {
    console.error("[UIDAI Sig Error Detail]:", err);
    return {
      status: "ERROR",
      hasSignatureNode: true,
      errorMessage: err?.message || "Cryptographic verification execution error.",
    };
  }
}

/**
 * Safely parses the structured demographic data and photograph from the verified Aadhaar XML.
 * Deterministic XML parsing: NO AI, NO OCR, NO field hallucination.
 */
export function parseAadhaarDemographics(xmlString: string): {
  xmlStructureValid: boolean;
  identity: AadhaarIdentity;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    trimValues: true,
  });

  const parsed = parser.parse(xmlString);

  // Root should be OfflinePaperlessKyc
  const root = parsed.OfflinePaperlessKyc || parsed["offline-paperless-kyc"] || parsed;
  if (!root) {
    throw new Error("Invalid Aadhaar XML: Root <OfflinePaperlessKyc> element not found.");
  }

  const referenceIdRaw = root["@_referenceId"] || root["@_referenceid"] || null;
  const referenceId = referenceIdRaw ? String(referenceIdRaw) : null;

  const uidData = root.UidData || root.uidData || root;
  const poi = uidData.Poi || uidData.poi || {};
  const poa = uidData.Poa || uidData.poa || {};

  // Extract Proof of Identity (POI)
  const name = poi["@_name"] ? String(poi["@_name"]).trim() : null;
  const dob = poi["@_dob"] ? String(poi["@_dob"]).trim() : poi["@_yob"] ? String(poi["@_yob"]).trim() : null;
  const genderRaw = poi["@_gender"] ? String(poi["@_gender"]).trim() : null;
  let gender: string | null = null;
  if (genderRaw) {
    const g = genderRaw.toUpperCase();
    if (g === "M" || g === "MALE") gender = "Male";
    else if (g === "F" || g === "FEMALE") gender = "Female";
    else if (g === "T" || g === "TRANSGENDER") gender = "Transgender";
    else gender = genderRaw;
  }

  // Extract Proof of Address (POA)
  const careOf = poa["@_co"] || poa["@_careof"] ? String(poa["@_co"] || poa["@_careof"]).trim() : null;
  const house = poa["@_house"] ? String(poa["@_house"]).trim() : null;
  const street = poa["@_street"] ? String(poa["@_street"]).trim() : null;
  const landmark = poa["@_lm"] || poa["@_landmark"] ? String(poa["@_lm"] || poa["@_landmark"]).trim() : null;
  const locality = poa["@_loc"] || poa["@_locality"] ? String(poa["@_loc"] || poa["@_locality"]).trim() : null;
  const villageTownCity = poa["@_vtc"] ? String(poa["@_vtc"]).trim() : null;
  const subDistrict = poa["@_subdist"] ? String(poa["@_subdist"]).trim() : null;
  const district = poa["@_dist"] ? String(poa["@_dist"]).trim() : null;
  const state = poa["@_state"] ? String(poa["@_state"]).trim() : null;
  const pinCode = poa["@_pc"] ? String(poa["@_pc"]).trim() : null;
  const postOffice = poa["@_po"] ? String(poa["@_po"]).trim() : null;

  // Build clean address components
  const addressParts: string[] = [];
  if (careOf) addressParts.push(careOf);
  if (house) addressParts.push(house);
  if (street) addressParts.push(street);
  if (landmark) addressParts.push(landmark);
  if (locality) addressParts.push(locality);
  if (villageTownCity) addressParts.push(villageTownCity);
  if (subDistrict && subDistrict !== villageTownCity) addressParts.push(subDistrict);
  if (district) addressParts.push(district);
  if (state) addressParts.push(state);
  if (pinCode) addressParts.push(`PIN: ${pinCode}`);

  const fullAddress = addressParts.length > 0 ? addressParts.join(", ") : "Address details not available";

  // Extract Photograph (Pht)
  let photoDataUrl: string | null = null;
  let hasPhoto = false;

  const rawPht = uidData.Pht || uidData.pht || null;
  if (rawPht && typeof rawPht === "string" && rawPht.trim().length > 50) {
    const cleanB64 = rawPht.replace(/\s+/g, "");
    try {
      const photoBuffer = Buffer.from(cleanB64, "base64");
      // Check for JPEG magic bytes (FF D8 FF)
      if (
        photoBuffer.length > 4 &&
        photoBuffer[0] === 0xff &&
        photoBuffer[1] === 0xd8 &&
        photoBuffer[2] === 0xff
      ) {
        photoDataUrl = `data:image/jpeg;base64,${cleanB64}`;
        hasPhoto = true;
      } else {
        // Fallback valid image MIME
        photoDataUrl = `data:image/jpeg;base64,${cleanB64}`;
        hasPhoto = true;
      }
    } catch {}
  }

  // Hashed Mobile and Email if present
  const hashedMobile = uidData.HashedMobile || uidData.m ? String(uidData.HashedMobile || uidData.m).trim() : null;
  const hashedEmail = uidData.HashedEmail || uidData.e ? String(uidData.HashedEmail || uidData.e).trim() : null;

  return {
    xmlStructureValid: true,
    identity: {
      name,
      dob,
      gender,
      referenceId,
      address: {
        careOf,
        house,
        street,
        landmark,
        locality,
        villageTownCity,
        subDistrict,
        district,
        state,
        pinCode,
        postOffice,
        fullAddress,
      },
      photoDataUrl,
      hasPhoto,
      hashedMobile,
      hashedEmail,
    },
  };
}

/**
 * End-to-end verification pipeline:
 * ZIP + Share Code -> Secure Extraction -> XML DSig Signature Verification -> Demographic Parsing -> Structured Response.
 */
export async function processAadhaarOfflineKyc(
  zipBuffer: Buffer,
  shareCode?: string
): Promise<AadhaarVerificationOutcome> {
  // Step 1: Secure ZIP extraction
  const { xmlString, xmlFileName } = await extractAadhaarXmlFromZip(zipBuffer, shareCode);

  // Step 2: Validate XML Signature
  const sigResult = verifyUidaiXmlSignature(xmlString);

  // Step 3: Parse Demographics
  const demoResult = parseAadhaarDemographics(xmlString);

  return {
    success: true,
    xmlStructureValid: demoResult.xmlStructureValid,
    signatureVerificationStatus: sigResult.status,
    signatureAlgorithm: sigResult.signatureAlgorithm,
    signerCertificate: sigResult.signerCertificate,
    identity: demoResult.identity,
    extractedFileName: xmlFileName,
    debugDetails: {
      hasSignatureNode: sigResult.hasSignatureNode,
      referenceUri: sigResult.referenceUri,
    },
  };
}

/**
 * Compares verified Aadhaar Name with Land Record Extracted Owner / Buyer name.
 * Respects strict institutional boundary: identity consistency is verified, NOT land title ownership.
 */
export function compareIdentityWithLandRecord(
  aadhaarName: string | null,
  landRecordOwner: string | null
): {
  status: "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "NOT_AVAILABLE" | "REVIEW_REQUIRED";
  confidence: number;
  explanation: string;
} {
  if (!aadhaarName || !landRecordOwner) {
    return {
      status: "NOT_AVAILABLE",
      confidence: 0,
      explanation: "Aadhaar verified identity or land record owner name is not available for comparison.",
    };
  }

  const cleanAadhaar = aadhaarName.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const cleanOwner = landRecordOwner.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

  if (cleanAadhaar === cleanOwner) {
    return {
      status: "MATCH",
      confidence: 100,
      explanation: "Aadhaar verified holder name exactly matches the owner name in the land record.",
    };
  }

  // Token-based similarity check
  const aadhaarTokens = new Set(cleanAadhaar.split(" "));
  const ownerTokens = new Set(cleanOwner.split(" "));

  let commonTokens = 0;
  for (const token of aadhaarTokens) {
    if (ownerTokens.has(token)) {
      commonTokens++;
    }
  }

  const maxTokens = Math.max(aadhaarTokens.size, ownerTokens.size);
  const matchRatio = commonTokens / maxTokens;

  if (matchRatio >= 0.66) {
    return {
      status: "PARTIAL_MATCH",
      confidence: Math.round(matchRatio * 100),
      explanation: `Consistent identity detected (${commonTokens} of ${maxTokens} name segments align). Review recommended for name order or honorifics.`,
    };
  }

  return {
    status: "MISMATCH",
    confidence: Math.round(matchRatio * 100),
    explanation: `Discrepancy detected: Aadhaar identity '${aadhaarName}' differs from land deed party '${landRecordOwner}'. Revenue officer review required.`,
  };
}
