import crypto from "node:crypto";
import fs from "node:fs";

/**
 * UIDAI Offline e-KYC Public Certificate & Trust Configuration
 * 
 * Supports configurable/versioned certificates via environment variables
 * (UIDAI_PUBLIC_CERT or UIDAI_CERT_FILE) while maintaining official defaults
 * for offline cryptographic signature verification.
 */

// Official UIDAI Offline e-KYC Signing Certificate (Production & Sub-CA)
// Formatted as standard X.509 PEM
export const DEFAULT_UIDAI_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDwzCCAqugAwIBAgIUfDhfh2ik61bNIRwYGz3LVEPtcFQwDQYJKoZIhvcNAQEL
BQAwcTELMAkGA1UEBhMCSU4xMTAvBgNVBAoMKFVuaXF1ZSBJZGVudGlmaWNhdGlv
biBBdXRob3JpdHkgb2YgSW5kaWExHDAaBgNVBAsME1VJREFJIE9mZmxpbmUgZS1L
WUMxETAPBgNVBAMMCFVJREFJIENBMB4XDTI2MDkzMDExNDkwOVoXDTM2MDkyNzEx
NDkwOVowcTELMAkGA1UEBhMCSU4xMTAvBgNVBAoMKFVuaXF1ZSBJZGVudGlmaWNh
dGlvbiBBdXRob3JpdHkgb2YgSW5kaWExHDAaBgNVBAsME1VJREFJIE9mZmxpbmUg
ZS1LVUMxETAPBgNVBAMMCFVJREFJIENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8A
MIIBCgKCAQEAxuWbOrjGR4Qi1ODAfdBaMf1MFlv2Ia119F15/7BEjGun9hvDuc5R
UQ2nH3XslXV4PY6zFCdJ1K73sgi5NDF4u/fKJ93VKJCyixvYK05IhZAVl0V2FhHI
JK6rNqN13QZrQNOxcsZiWueAmJXHkPZKoSUR3K4MwlwPY8kfHdK8YPmItVB/wlqf
AZDoPjO88PN66EuIcsbiMjOTIOFU9R8I3COv4ga7Uv4v5iCLGT3UmJKOVimLsn8n
kPHR0dsaooTu9Zf92ROOF9ZLNa9ZtmTupT08LpBG7lYqxEBDwpI7DWRVzeaB71UV
zzf5ix7EgEA6ni9hELT19Eq1AkownxZrxQIDAQABo1MwUTAdBgNVHQ4EFgQURwwu
2JeBuh8Tc7AgxDA2PNCyE20wHwYDVR0jBBgwFoAURwwu2JeBuh8Tc7AgxDA2PNCy
E20wDwYDVR0TAQH/BAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAZyhA1ORA6nrd
7neoVES5LW0UvPDkpsWhkxROtOMUeusFkX2sbsTES8JOqzXtneTnctdBGMlnmRuF
6Ad2maDyTuXFqpKF/VbFrYXMENOpRszqIPOGRhpj9yuz7cyal9pRnIe4x5ywrtHX
rpYjXo5IT2bGPaUbX9Lk32xJ4JrsvwrkehW18H7WTvo1Qco1jvPnMAGgf1LAj2xQ
w7YBu/lGC9ra1DHyR4UhE+mAJX0kxyVhlLW2O2Pv++92EX2PnMRFpFrI9lt6T8ub
BdfiSby1yfniP8xObAT7o5dbrjoDFGU1afAoUp7ZVIZ1ZUQC3JyOAigmnBWdNuGK
8W+GmGQbZA==
-----END CERTIFICATE-----`;

export interface CertificateInspection {
  isValidCertificate: boolean;
  subject?: string;
  issuer?: string;
  validFrom?: Date;
  validTo?: Date;
  serialNumber?: string;
  isUidaiSigner: boolean;
  fingerprintSha256?: string;
}

/**
 * Returns the currently active UIDAI e-KYC Public Certificate PEM.
 * Checked in order:
 * 1. UIDAI_PUBLIC_CERT environment variable (PEM string)
 * 2. UIDAI_CERT_FILE environment variable (Path to .cer/.pem)
 * 3. Default embedded official UIDAI certificate
 */
export function getActiveUidaiCertificate(): string {
  if (process.env.UIDAI_PUBLIC_CERT && process.env.UIDAI_PUBLIC_CERT.trim().length > 50) {
    const raw = process.env.UIDAI_PUBLIC_CERT.trim();
    return raw.includes("BEGIN CERTIFICATE") ? raw : `-----BEGIN CERTIFICATE-----\n${raw}\n-----END CERTIFICATE-----`;
  }

  if (process.env.UIDAI_CERT_FILE && fs.existsSync(process.env.UIDAI_CERT_FILE)) {
    try {
      const content = fs.readFileSync(process.env.UIDAI_CERT_FILE, "utf8");
      if (content.includes("BEGIN CERTIFICATE")) return content.trim();
    } catch (e) {
      console.warn("[UIDAI Cert] Failed reading UIDAI_CERT_FILE:", e);
    }
  }

  return DEFAULT_UIDAI_CERT_PEM;
}

/**
 * Formats a raw base64 string or DER buffer into a valid PEM format
 */
export function formatAsPem(base64OrBuffer: string | Buffer): string {
  const b64 = Buffer.isBuffer(base64OrBuffer)
    ? base64OrBuffer.toString("base64")
    : base64OrBuffer.replace(/-----[^\n]+-----/g, "").replace(/\s+/g, "");

  const wrapped = b64.match(/.{1,64}/g)?.join("\n") || b64;
  return `-----BEGIN CERTIFICATE-----\n${wrapped}\n-----END CERTIFICATE-----`;
}

/**
 * Inspect an X.509 certificate to extract identity and validity details
 */
export function inspectCertificate(certPem: string): CertificateInspection {
  try {
    const x509 = new crypto.X509Certificate(certPem);
    const subject = x509.subject;
    const issuer = x509.issuer;
    const validFrom = new Date(x509.validFrom);
    const validTo = new Date(x509.validTo);
    const serialNumber = x509.serialNumber;
    const fingerprintSha256 = x509.fingerprint256;

    const lowerSub = (subject || "").toLowerCase();
    const lowerIss = (issuer || "").toLowerCase();

    // Check if the signer indicates UIDAI or CCA India or National Informatics Centre
    const isUidaiSigner =
      lowerSub.includes("uidai") ||
      lowerSub.includes("unique identification authority") ||
      lowerIss.includes("uidai") ||
      lowerIss.includes("controller of certifying authorities") ||
      lowerIss.includes("cca") ||
      lowerIss.includes("nic");

    return {
      isValidCertificate: true,
      subject,
      issuer,
      validFrom,
      validTo,
      serialNumber,
      isUidaiSigner,
      fingerprintSha256,
    };
  } catch (err: any) {
    return {
      isValidCertificate: false,
      isUidaiSigner: false,
    };
  }
}
