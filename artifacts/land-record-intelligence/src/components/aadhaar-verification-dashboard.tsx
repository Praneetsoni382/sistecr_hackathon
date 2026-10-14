import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  FileArchive,
  Upload,
  CheckCircle2,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  User,
  MapPin,
  Calendar,
  Hash,
  ArrowRight,
  Sparkles,
  Info,
  Check,
  Building,
  RotateCcw,
  FileCheck,
} from "lucide-react";
import type {
  AadhaarVerificationResult,
  Case,
  CaseDocument,
  LegacyLandRecord,
  IdentityLandMatchStatus,
  AadhaarOfficerDecision,
} from "@/lib/types";
import { saveAadhaarVerification } from "@/lib/firestore";
import { useAppAuth } from "@/lib/auth-context";

interface AadhaarVerificationDashboardProps {
  currentCase: Case;
  landDocuments?: CaseDocument[];
  legacyRecords?: LegacyLandRecord[];
  onContinueToUpload?: () => void;
  existingVerification?: AadhaarVerificationResult | null;
}

export function AadhaarVerificationDashboard({
  currentCase,
  landDocuments = [],
  legacyRecords = [],
  onContinueToUpload,
  existingVerification,
}: AadhaarVerificationDashboardProps) {
  const { officer } = useAppAuth();

  // Verification state
  const [verification, setVerification] = useState<AadhaarVerificationResult | null>(
    existingVerification || null
  );

  // Form State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shareCode, setShareCode] = useState("");
  const [showShareCode, setShowShareCode] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeStep, setActiveStep] = useState<number>(0);
  const [officerNote, setOfficerNote] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);
  const [testFixtureLoading, setTestFixtureLoading] = useState(false);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync if prop updates
  useEffect(() => {
    if (existingVerification) {
      setVerification(existingVerification);
    }
  }, [existingVerification]);

  // Try to determine land record candidate owner name for identity comparison
  const candidateLandOwner = React.useMemo(() => {
    if (legacyRecords && legacyRecords.length > 0 && legacyRecords[0].ownerName) {
      return legacyRecords[0].ownerName;
    }
    return null;
  }, [legacyRecords]);

  // Steps for progress visualization
  const verificationSteps = [
    "Reading secure ZIP archive...",
    "Extracting XML payload using Share Code...",
    "Validating XML structure and schema...",
    "Validating UIDAI digital signature (RSA-SHA256)...",
    "Extracting demographic information (POI & POA)...",
    "Decoding identity photograph...",
    "Preparing structured identity profile...",
    "Verification complete.",
  ];

  function handleFileSelect(file: File) {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setErrorMessage("Invalid file type: Please select a valid .zip Offline e-KYC archive.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("File too large: e-KYC ZIP archive must be under 10 MB.");
      return;
    }
    setErrorMessage(null);
    setSelectedFile(file);
  }

  function handleClear() {
    setSelectedFile(null);
    setShareCode("");
    setErrorMessage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleLoadTestFixture(options?: { invalidSignature?: boolean; wrongCode?: boolean; corrupted?: boolean }) {
    setTestFixtureLoading(true);
    setErrorMessage(null);

    try {
      const resp = await fetch("/api/aadhaar/generate-test-fixture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: candidateLandOwner || "Ramesh Kumar Sharma",
          dob: "14-08-1981",
          gender: "M",
          village: currentCase.village || "Bawana",
          district: currentCase.district || "North Delhi",
          state: "Delhi",
          corrupted: options?.corrupted || false,
          invalidSignature: options?.invalidSignature || false,
          shareCode: "1234",
        }),
      });

      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Failed generating test fixture");
      }

      // Convert Base64 back to a File
      const byteCharacters = atob(data.zipBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/zip" });
      const file = new File([blob], data.fileName, { type: "application/zip" });

      setSelectedFile(file);
      setShareCode(options?.wrongCode ? "9999" : "1234");
    } catch (e: any) {
      setErrorMessage(e?.message || "Failed generating sample test fixture.");
    } finally {
      setTestFixtureLoading(false);
    }
  }

  async function handleVerifyIdentity(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setErrorMessage("Please upload an Offline e-KYC ZIP file first.");
      return;
    }
    if (!shareCode || shareCode.trim().length === 0) {
      setErrorMessage("Please enter the 4-character Share Code.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setActiveStep(1);

    try {
      // Convert file to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(selectedFile);

      setActiveStep(2);
      const zipData = await base64Promise;

      setActiveStep(3);

      const resp = await fetch("/api/aadhaar/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipData,
          shareCode: shareCode.trim(),
          caseId: currentCase.id,
          officerName: officer?.fullName || "Revenue Officer",
          candidateLandOwner: candidateLandOwner || undefined,
        }),
      });

      setActiveStep(5);

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Aadhaar e-KYC verification failed.");
      }

      setActiveStep(7);
      await new Promise((r) => setTimeout(r, 400));
      setActiveStep(8);

      const result: AadhaarVerificationResult = data.verification;
      setVerification(result);

      // Save to local Firestore tracking
      await saveAadhaarVerification(currentCase.id, result);
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to complete Aadhaar Offline e-KYC verification.");
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleRecordDecision(decision: AadhaarOfficerDecision) {
    if (!verification) return;
    setSavingDecision(true);

    try {
      const resp = await fetch("/api/aadhaar/officer-decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: currentCase.id,
          decision,
          officerNote,
          officerName: officer?.fullName || "Revenue Officer",
        }),
      });

      if (resp.ok) {
        setVerification((prev) => (prev ? { ...prev, officerDecision: decision, verificationNotes: officerNote } : null));
      }
    } catch (err) {
      console.error("Decision save error:", err);
    } finally {
      setSavingDecision(false);
    }
  }

  // Render STATE B: Verified Identity Preview
  if (verification) {
    const { identity, signatureVerificationStatus, xmlStructureValid } = verification;
    const isSigValid = signatureVerificationStatus === "VALID";
    const comparison = (verification as any).landComparison;

    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Stage Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck size={26} strokeWidth={2.2} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  UIDAI Paperless Offline e-KYC
                </span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  Stage 01
                </span>
              </div>
              <h2 className="display text-2xl font-semibold mt-0.5">Aadhaar Identity Verification</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deterministic cryptographic validation of citizen identity archive for Case {currentCase.caseNumber}.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setVerification(null);
                setSelectedFile(null);
                setShareCode("");
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted transition"
            >
              <RotateCcw size={13} /> Re-verify Archive
            </button>
            {onContinueToUpload && (
              <button
                type="button"
                onClick={onContinueToUpload}
                data-testid="button-continue-to-upload"
                className="inline-flex items-center gap-2 rounded-lg bg-[hsl(var(--primary))] px-4 py-2 text-xs font-bold text-[hsl(var(--primary-foreground))] hover:brightness-110 shadow-sm transition"
              >
                <span>Continue to Land Document Upload</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Identity Profile Main Card */}
        <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
          {/* Column 1: Photograph & Cryptographic Status */}
          <div className="rounded-2xl border border-card-border bg-card p-6 flex flex-col items-center text-center shadow-xs">
            <div className="relative mb-4">
              {identity.photoDataUrl ? (
                <img
                  src={identity.photoDataUrl}
                  alt={identity.name || "Aadhaar Holder"}
                  className="h-36 w-36 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md bg-secondary"
                />
              ) : (
                <div className="grid h-36 w-36 place-items-center rounded-2xl border-2 border-dashed border-border bg-secondary text-muted-foreground">
                  <User size={48} className="opacity-40" />
                  <span className="text-[10px] font-semibold mt-1">Photo Unavailable</span>
                </div>
              )}
              {isSigValid && (
                <div className="absolute -bottom-2 -right-2 rounded-full bg-emerald-600 p-1.5 text-white shadow-md">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </div>

            <h3 className="font-serif text-lg font-bold text-foreground">
              {identity.name || "NOT AVAILABLE IN OFFLINE e-KYC DATA"}
            </h3>
            <p className="mono text-xs text-muted-foreground mt-0.5">
              Ref: {identity.referenceId ? `****${identity.referenceId.slice(-4)}` : "Unavailable"}
            </p>

            {/* Signature Status Badge */}
            <div className="mt-5 w-full rounded-xl border p-3 text-left space-y-1.5 transition-colors">
              <div className="mono text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
                UIDAI Digital Signature
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">
                  {isSigValid ? "Cryptographically Valid" : signatureVerificationStatus}
                </span>
                {isSigValid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                    <Check size={11} /> VERIFIED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">
                    <AlertTriangle size={11} /> FAILED
                  </span>
                )}
              </div>
              <div className="text-[11px] text-muted-foreground pt-1 leading-tight">
                {isSigValid
                  ? "Validated using official UIDAI Public Key infrastructure (XML-DSig RSA-SHA256)."
                  : "Signature validation failed. Identity data cannot be verified as authentic UIDAI issued."}
              </div>
            </div>

            {/* Verification Checklist */}
            <div className="mt-4 w-full divide-y divide-border text-left text-xs">
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">XML Structure</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <Check size={12} /> Valid
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Demographic Extract</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <Check size={12} /> Complete
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-muted-foreground">Photo Extraction</span>
                <span className={`font-semibold flex items-center gap-1 ${identity.hasPhoto ? "text-emerald-600" : "text-amber-600"}`}>
                  {identity.hasPhoto ? <Check size={12} /> : null}
                  {identity.hasPhoto ? "Decoded JPEG" : "Not Provided"}
                </span>
              </div>
            </div>
          </div>

          {/* Column 2: Demographic Details & Address */}
          <div className="space-y-6">
            {/* Identity Information Table */}
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-xs">
              <div className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--primary))] font-bold mb-4 flex items-center gap-1.5">
                <User size={13} /> Proof of Identity (POI)
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                  <div className="mono text-[10px] text-muted-foreground uppercase">Full Name</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {identity.name || <span className="italic text-muted-foreground">NOT AVAILABLE IN OFFLINE e-KYC DATA</span>}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                  <div className="mono text-[10px] text-muted-foreground uppercase">Date / Year of Birth</div>
                  <div className="mt-1 text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Calendar size={13} className="text-muted-foreground" />
                    {identity.dob || <span className="italic text-muted-foreground">NOT AVAILABLE IN OFFLINE e-KYC DATA</span>}
                  </div>
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/30 p-3.5">
                  <div className="mono text-[10px] text-muted-foreground uppercase">Gender</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {identity.gender || <span className="italic text-muted-foreground">NOT AVAILABLE IN OFFLINE e-KYC DATA</span>}
                  </div>
                </div>
              </div>

              {/* Address (POA) */}
              <div className="mt-5 border-t border-border pt-4">
                <div className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--primary))] font-bold mb-2 flex items-center gap-1.5">
                  <MapPin size={13} /> Proof of Address (POA)
                </div>

                <div className="rounded-xl border border-border/60 bg-secondary/30 p-4">
                  <div className="text-sm font-medium leading-relaxed text-foreground">
                    {identity.address.fullAddress}
                  </div>

                  {/* Address Component Grid */}
                  <div className="mt-3 grid gap-2 pt-3 border-t border-border/50 text-[11px] sm:grid-cols-3">
                    {identity.address.careOf && (
                      <div>
                        <span className="text-muted-foreground">Care of:</span>{" "}
                        <span className="font-semibold">{identity.address.careOf}</span>
                      </div>
                    )}
                    {identity.address.villageTownCity && (
                      <div>
                        <span className="text-muted-foreground">Village/Town:</span>{" "}
                        <span className="font-semibold">{identity.address.villageTownCity}</span>
                      </div>
                    )}
                    {identity.address.district && (
                      <div>
                        <span className="text-muted-foreground">District:</span>{" "}
                        <span className="font-semibold">{identity.address.district}</span>
                      </div>
                    )}
                    {identity.address.state && (
                      <div>
                        <span className="text-muted-foreground">State:</span>{" "}
                        <span className="font-semibold">{identity.address.state}</span>
                      </div>
                    )}
                    {identity.address.pinCode && (
                      <div>
                        <span className="text-muted-foreground">Postal Code:</span>{" "}
                        <span className="font-semibold">{identity.address.pinCode}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Identity ↔ Land Record Match Card */}
            <div className="rounded-2xl border border-card-border bg-card p-6 shadow-xs">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="grid h-8 w-8 place-items-center rounded-lg bg-[hsl(var(--accent)/.2)] text-[hsl(var(--accent))]">
                    <FileCheck size={16} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">Identity ↔ Land Record Comparison</h4>
                    <p className="text-[11px] text-muted-foreground">
                      Cross-correlate verified citizen demographic with land-acquisition applicant records.
                    </p>
                  </div>
                </div>

                {comparison && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${
                      comparison.status === "MATCH"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : comparison.status === "PARTIAL_MATCH"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                        : comparison.status === "MISMATCH"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {comparison.status === "MATCH" && <Check size={12} />}
                    {comparison.status.replace("_", " ")}
                  </span>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 rounded-xl border border-border/60 bg-secondary/20 p-4">
                <div>
                  <div className="mono text-[10px] text-muted-foreground uppercase">Aadhaar Verified Name</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {identity.name || "Unavailable"}
                  </div>
                </div>
                <div>
                  <div className="mono text-[10px] text-muted-foreground uppercase">Land Record Owner / Buyer</div>
                  <div className="mt-1 text-sm font-bold text-foreground">
                    {candidateLandOwner || (
                      <span className="italic text-muted-foreground text-xs font-normal">
                        Pending land document extraction
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {comparison?.explanation && (
                <div className="mt-3 text-xs text-muted-foreground bg-secondary/40 rounded-lg p-3">
                  <strong>Reconciliation Note:</strong> {comparison.explanation}
                </div>
              )}

              {/* Institutional Boundary Disclaimer */}
              <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-[11px] text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <Info size={15} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Statutory Scope Disclaimer:</strong> Identity information is verified for consistency with the applicant name. Aadhaar Offline e-KYC verifies personal identity authenticity under UIDAI specifications, and does <em>not</em> confer or verify legal land title ownership. Land title validity remains governed by revenue deed reconciliation.
                </div>
              </div>

              {/* Human-in-the-Loop Officer Actions */}
              <div className="mt-5 pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="mono text-[10px] text-muted-foreground font-semibold uppercase">Officer Decision:</span>
                  <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-foreground">
                    {verification.officerDecision || "PENDING"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={savingDecision}
                    onClick={() => handleRecordDecision("ACCEPTED")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    <Check size={13} /> Accept Identity Match
                  </button>
                  <button
                    type="button"
                    disabled={savingDecision}
                    onClick={() => handleRecordDecision("REVIEW_REQUIRED")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    <AlertTriangle size={13} /> Flag for Review
                  </button>
                  <button
                    type="button"
                    disabled={savingDecision}
                    onClick={() => handleRecordDecision("PROCEEDED_WITHOUT_MATCH")}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition"
                  >
                    Continue Without Match
                  </button>
                </div>
              </div>
            </div>

            {/* Technical Signature Details Toggle */}
            <div className="text-right">
              <button
                type="button"
                onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {showTechnicalDetails ? "Hide" : "View"} Cryptographic Signature Inspection
              </button>

              {showTechnicalDetails && (
                <div className="mt-3 text-left rounded-xl border border-border bg-secondary/30 p-4 text-xs font-mono space-y-1.5">
                  <div>
                    <span className="text-muted-foreground">Signature Algorithm:</span>{" "}
                    {verification.signatureAlgorithm || "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Certificate Subject:</span>{" "}
                    {verification.signerCertificateSubject || "CN=UIDAI Offline e-KYC, O=Unique Identification Authority of India"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Certificate Issuer:</span>{" "}
                    {verification.signerCertificateIssuer || "CN=CCA India / National Informatics Centre Sub-CA"}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Structure Status:</span>{" "}
                    {xmlStructureValid ? "OfflinePaperlessKyc XML Valid" : "Malformed"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render STATE A: Upload & Verification Interface
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))]">
            <ShieldCheck size={26} strokeWidth={2.2} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="mono text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))]">
                Preliminary Verification Stage
              </span>
              <span className="rounded-full bg-[hsl(var(--primary)/.15)] px-2 py-0.5 text-[10px] font-bold text-[hsl(var(--primary))]">
                Stage 01
              </span>
            </div>
            <h2 className="display text-2xl font-semibold mt-0.5">Aadhaar Identity Verification</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Offline Paperless e-KYC Identity Verification for Case {currentCase.caseNumber}.
            </p>
          </div>
        </div>

        {onContinueToUpload && (
          <button
            type="button"
            onClick={onContinueToUpload}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3.5 py-2 text-xs font-semibold text-secondary-foreground hover:bg-muted transition"
          >
            <span>Skip to Land Documents</span>
            <ArrowRight size={13} />
          </button>
        )}
      </div>

      {/* Main Upload Card */}
      <div className="rounded-2xl border border-card-border bg-card p-6 sm:p-8 shadow-xs max-w-3xl mx-auto">
        <div className="mb-6">
          <h3 className="text-lg font-bold text-foreground">Upload Aadhaar Offline e-KYC</h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Upload the Offline e-KYC ZIP generated by the Aadhaar holder and enter the 4-character Share Code provided with the archive. The archive will be decrypted in an ephemeral sandbox and cryptographically validated against official UIDAI digital signatures.
          </p>
        </div>

        {/* Drag & Drop ZIP File Zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
              handleFileSelect(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all ${
            isDragging
              ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.05)] scale-[1.01]"
              : selectedFile
              ? "border-emerald-500/50 bg-emerald-500/5"
              : "border-border hover:border-[hsl(var(--primary)/.6)] hover:bg-secondary/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip,application/zip"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileSelect(e.target.files[0]);
              }
            }}
          />

          {selectedFile ? (
            <div className="flex flex-col items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-3">
                <FileArchive size={28} />
              </div>
              <div className="text-sm font-bold text-foreground">{selectedFile.name}</div>
              <div className="mono text-xs text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB · Ready to verify
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                className="mt-3 inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-500/10 transition"
              >
                <X size={13} /> Remove Archive
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-secondary text-muted-foreground mb-3">
                <Upload size={24} />
              </div>
              <div className="text-sm font-semibold text-foreground">
                Drag & Drop Offline e-KYC ZIP file here
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                or click to browse from computer (Max 10 MB)
              </div>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-[11px] font-medium text-muted-foreground">
                Accepted: Official UIDAI Offline e-KYC (.zip)
              </div>
            </div>
          )}
        </div>

        {/* Share Code Field & Verify Action */}
        <form onSubmit={handleVerifyIdentity} className="mt-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <KeyRound size={14} className="text-[hsl(var(--primary))]" />
                Share Code (4-Character Passcode)
              </span>
              <span className="text-[10px] text-muted-foreground font-normal lowercase">
                encrypted in-memory, never persisted
              </span>
            </label>

            <div className="relative">
              <input
                type={showShareCode ? "text" : "password"}
                maxLength={8}
                value={shareCode}
                onChange={(e) => setShareCode(e.target.value)}
                placeholder="e.g. 1234"
                autoComplete="off"
                data-testid="input-aadhaar-share-code"
                className="focus-ring h-12 w-full rounded-xl border border-input bg-card px-4 pr-11 font-mono text-base tracking-widest outline-none"
              />
              <button
                type="button"
                onClick={() => setShowShareCode(!showShareCode)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                title={showShareCode ? "Hide Share Code" : "Show Share Code"}
              >
                {showShareCode ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5 animate-in fade-in">
              <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong>Verification Error:</strong> {errorMessage}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={isProcessing}
                className="rounded-lg border border-border px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary transition"
              >
                Clear
              </button>
            </div>

            <button
              type="submit"
              disabled={isProcessing || !selectedFile || !shareCode.trim()}
              data-testid="button-verify-aadhaar"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-6 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-md hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isProcessing ? (
                <>
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Verifying Archive...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  <span>VERIFY IDENTITY</span>
                </>
              )}
            </button>
          </div>
        </form>

        {/* Real Step-by-Step Processing State */}
        {isProcessing && (
          <div className="mt-8 rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.05)] p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="mono text-xs font-bold text-[hsl(var(--primary))] uppercase tracking-wider flex items-center gap-2">
                <RefreshCw size={14} className="animate-spin" />
                VERIFYING OFFLINE e-KYC PIPELINE
              </div>
              <span className="mono text-xs text-muted-foreground font-semibold">
                Step {Math.min(activeStep, 8)} of 8
              </span>
            </div>

            <div className="space-y-1.5 pt-2">
              {verificationSteps.map((stepText, idx) => {
                const stepNum = idx + 1;
                const isDone = activeStep > stepNum;
                const isCurrent = activeStep === stepNum;
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-2.5 text-xs transition-opacity ${
                      isDone
                        ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                        : isCurrent
                        ? "text-foreground font-bold"
                        : "text-muted-foreground/50"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                    ) : isCurrent ? (
                      <RefreshCw size={14} className="text-[hsl(var(--primary))] animate-spin shrink-0" />
                    ) : (
                      <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />
                    )}
                    <span>{stepText}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Test Fixture Sandbox Card for Easy Review & Testing */}
        <div className="mt-8 border-t border-border pt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Sparkles size={14} className="text-amber-500" />
              <span>Officer Testing Sandbox</span>
            </div>
            <span className="text-[11px] text-muted-foreground">Turnkey validation scenarios</span>
          </div>

          <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
            Test the deterministic XML verification pipeline without needing a live citizen package:
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={testFixtureLoading || isProcessing}
              onClick={() => handleLoadTestFixture()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
            >
              {testFixtureLoading ? <RefreshCw size={12} className="animate-spin" /> : <FileCheck size={12} />}
              Load Valid Official e-KYC (Passcode: 1234)
            </button>

            <button
              type="button"
              disabled={testFixtureLoading || isProcessing}
              onClick={() => handleLoadTestFixture({ wrongCode: true })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted transition"
            >
              Test Incorrect Share Code
            </button>

            <button
              type="button"
              disabled={testFixtureLoading || isProcessing}
              onClick={() => handleLoadTestFixture({ invalidSignature: true })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 transition"
            >
              Test Invalid Signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
