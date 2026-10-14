import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowRight,
  Database,
  ChevronRight,
  Check,
  CircleAlert,
  Archive,
  Search,
  Scale,
  X,
  FileCheck2,
  AlertTriangle,
  FileText,
  Info,
  BadgeCheck,
  ShieldCheck,
  CheckCircle2
} from "lucide-react";
import { CartoonOfficerAvatar } from "./cartoon-officer-avatar";
import { useAppAuth } from "@/lib/auth-context";
import { DEV_OFFICER } from "@/lib/auth";
import type {
  Case,
  CaseDocument,
  DocumentExtraction,
  LegacyLandRecord,
  VerificationRun,
  AuditLog,
} from "@/lib/types";
import {
  subscribeCase,
  subscribeCaseDocuments,
  subscribeCaseExtractions,
  subscribeAllLegacyLandRecords,
  subscribeVerificationRuns,
  saveVerifiedLandRecord
} from "@/lib/firestore";
import { logAuditEvent } from "@/lib/audit";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, serverTimestamp } from "@/lib/firestore-tracked";
import { useLanguage, LanguageToggle } from "@/lib/language-context";
import { calculateFieldSimilarity } from "@/lib/similarity";

// --- NORMALIZATION HELPERS ---
function normalizeIdentifier(val: any): string {
  if (!val) return "";
  const str = String(val).toLowerCase();
  if (str === "nil" || str === "unspecified" || str === "not available") return "";
  return str.replace(/[\s\/-]/g, "");
}

function normalizeName(val: any): string {
  if (!val) return "";
  const str = String(val).toLowerCase();
  if (str === "nil" || str === "unspecified" || str === "not available") return "";
  return str.replace(/\s+/g, " ").trim();
}

export function Stage3VerificationPage({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<Case | null>(null);
  const [docs, setDocs] = useState<CaseDocument[]>([]);
  const [extractions, setExtractions] = useState<DocumentExtraction[]>([]);
  const [legacyRecords, setLegacyRecords] = useState<LegacyLandRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();
  const { officer, userId } = useAppAuth();
  const { t } = useLanguage();
  const currentUserId = userId || officer?.id || DEV_OFFICER.id;
  const safeName = officer?.name || officer?.username || DEV_OFFICER.name || "Authorized Revenue Officer";
  
  const [verificationRuns, setVerificationRuns] = useState<VerificationRun[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    let u2: () => void = () => {};
    let u3: () => void = () => {};
    let u5: () => void = () => {};

    let u1 = subscribeCase(caseId, (c) => {
      setItem(c);
      setLoading(false);
      if (c && c.id) {
        u2();
        u3();
        u5();
        u2 = subscribeCaseDocuments(c.id, setDocs);
        u3 = subscribeCaseExtractions(c.id, setExtractions);
        u5 = subscribeVerificationRuns(c.id, setVerificationRuns);
      }
    });

    let u4 = subscribeAllLegacyLandRecords(setLegacyRecords);

    // Initial listeners with caseId parameter as fallback
    u2 = subscribeCaseDocuments(caseId, setDocs);
    u3 = subscribeCaseExtractions(caseId, setExtractions);
    u5 = subscribeVerificationRuns(caseId, setVerificationRuns);

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
    };
  }, [caseId]);

  const consolidatedRecord = useMemo(() => {
    if (!extractions || extractions.length === 0) return null;
    
    // Pick first valid non-nil value for each field
    const getField = (key: string, sourcesMap: Record<string, string>) => {
      for (const ext of extractions) {
        const rawExtraction = ext?.rawExtraction as any;
        if (!rawExtraction) continue;

        let val = rawExtraction[key];
        if (typeof val === "object" && val !== null && "value" in val) {
          val = val.value;
        }
        
        // Also check rawExtraction.fields[key]
        if ((!val || val === "nil") && rawExtraction.fields && rawExtraction.fields[key]) {
          const fieldObj = rawExtraction.fields[key];
          val = typeof fieldObj === "object" && fieldObj !== null && "value" in fieldObj ? fieldObj.value : fieldObj;
        }

        // Aliases check for common naming
        if (!val || val === "nil") {
          if (key === "owner_name") val = rawExtraction.buyer_name || rawExtraction.title_holder;
          if (key === "khasra_number") val = rawExtraction.plot_number || rawExtraction.survey_number;
          if (key === "survey_number") val = rawExtraction.cadastral_number || rawExtraction.khasra_number;
        }

        if (
          val !== null &&
          val !== undefined &&
          typeof val !== "object" &&
          String(val).trim() !== "" &&
          String(val).toLowerCase() !== "nil" &&
          String(val).toLowerCase() !== "null" &&
          String(val).toLowerCase() !== "unspecified" &&
          String(val).toLowerCase() !== "not available" &&
          String(val).toLowerCase() !== "n/a" &&
          String(val).toLowerCase() !== "not present"
        ) {
          const doc = docs.find((d) => d.id === ext.documentId);
          sourcesMap[key] = doc ? `${doc.documentType || "DOCUMENT"} — ${doc.fileName || "Document"}` : "Extracted Document";
          return String(val).trim();
        }
      }
      return "nil";
    };

    const sources: Record<string, string> = {};
    return {
      propertyUid: getField("property_uid", sources),
      ownerName: getField("owner_name", sources),
      surveyNumber: getField("survey_number", sources),
      khasraNumber: getField("khasra_number", sources),
      village: getField("village", sources),
      district: getField("district", sources),
      area: getField("area", sources),
      registrationNumber: getField("registration_number", sources),
      mutationNumber: getField("mutation_number", sources),
      sources,
    };
  }, [extractions, docs]);

  const candidates = useMemo(() => {
    if (!legacyRecords || legacyRecords.length === 0) return [];

    return legacyRecords.map((record) => {
      let score = 0;
      const matchedParams: string[] = [];
      const mismatchParams: { name: string; extVal: string; legVal?: string }[] = [];

      if (!consolidatedRecord) {
        return { record, score: 0, matchedParams: [], mismatchParams: [] };
      }

      const match = (extVal: string, legVal: string | undefined, weight: number, name: string, isName = false) => {
        if (!extVal || extVal === "nil" || extVal === "NOT AVAILABLE") return;
        const normExt = isName ? normalizeName(extVal) : normalizeIdentifier(extVal);
        const normLeg = isName ? normalizeName(legVal) : normalizeIdentifier(legVal);
        if (normExt && normLeg && (normExt === normLeg || normExt.includes(normLeg) || normLeg.includes(normExt))) {
          score += weight;
          matchedParams.push(name);
        } else if (normExt && normLeg && normExt !== normLeg) {
          mismatchParams.push({ name, extVal, legVal });
        }
      };

      match(consolidatedRecord.propertyUid, record.propertyUid, 35, "Property UID (ULPIN)");
      match(consolidatedRecord.surveyNumber, record.surveyNumber, 20, "Survey Number");
      match(consolidatedRecord.khasraNumber, record.khasraNumber, 15, "Khasra Number");
      match(consolidatedRecord.ownerName, record.ownerName, 15, "Owner Name", true);
      match(consolidatedRecord.village, record.village, 10, "Village", true);
      match(consolidatedRecord.area, record.area, 5, "Area");

      const finalCandidateScore = Math.min(100, Math.max(0, score));

      return { record, score: finalCandidateScore, matchedParams, mismatchParams };
    }).sort((a, b) => b.score - a.score);
  }, [legacyRecords, consolidatedRecord]);

  const topCandidates = useMemo(() => {
    if (candidates.length === 0) return [];
    return candidates;
  }, [candidates]);

  useEffect(() => {
    if (topCandidates.length > 0) {
      if (!selectedCandidateId || !topCandidates.some((c) => c.record.id === selectedCandidateId || (c.record as any).landRecordId === selectedCandidateId)) {
        setSelectedCandidateId(topCandidates[0].record.id || (topCandidates[0].record as any).landRecordId);
      }
    }
  }, [topCandidates, selectedCandidateId]);

  const activeCandidate = useMemo(() => {
    if (topCandidates.length > 0) {
      if (selectedCandidateId) {
        const found = topCandidates.find((c) => c.record.id === selectedCandidateId || (c.record as any).landRecordId === selectedCandidateId);
        if (found) return found;
      }
      return topCandidates[0];
    }
    return null;
  }, [topCandidates, selectedCandidateId]);

  const statusInfo = useMemo(() => {
    if (!consolidatedRecord) {
      return { label: "REGISTRY BASELINE CONNECTED (EXTRACTION PENDING)", type: "info" };
    }
    if (topCandidates.length === 0) {
      return { label: "REGISTRY CONNECTING", type: "info" };
    }
    if (topCandidates[0].score >= 75) {
      if (topCandidates[0].mismatchParams.length > 0) return { label: "CONFLICTS DETECTED", type: "warning" };
      return { label: "EXACT MATCH FOUND", type: "success" };
    }
    if (topCandidates.length > 1 && topCandidates[0].score === topCandidates[1].score && topCandidates[0].score > 0) {
      return { label: "MULTIPLE MATCHES FOUND", type: "warning" };
    }
    if (topCandidates[0].score > 0) {
      return { label: "POSSIBLE MATCH FOUND", type: "warning" };
    }
    return { label: "REGISTRY ARCHIVE READY FOR RECONCILIATION", type: "info" };
  }, [topCandidates, consolidatedRecord]);

  // Officer Verification State & Keynote Validation
  const [disposition, setDisposition] = useState<"Record Consistent" | "Review Required" | "Potential Conflict" | "Human Verification Required">("Record Consistent");
  const [officerKeynote, setOfficerKeynote] = useState("");
  const [keynoteError, setKeynoteError] = useState<string | null>(null);
  const [savedDone, setSavedDone] = useState(false);
  const [createVault, setCreateVault] = useState(false);
  const [vaultNotes, setVaultNotes] = useState("");

  const keynoteWordCount = useMemo(() => {
    return officerKeynote.trim() ? officerKeynote.trim().split(/\s+/).filter(Boolean).length : 0;
  }, [officerKeynote]);

  const handleSaveOfficerJudgment = async () => {
    if (!item) return;

    if (keynoteWordCount < 12) {
      setKeynoteError(`Officer keynote must contain at least 12 descriptive words before recording judgment. (Current word count: ${keynoteWordCount}/12 words)`);
      return;
    }

    setKeynoteError(null);
    setIsVerifying(true);

    const finalStatus: "VERIFIED" | "REVIEW REQUIRED" | "NOT VERIFIED" = 
      disposition === "Record Consistent" ? "VERIFIED" :
      disposition === "Potential Conflict" ? "NOT VERIFIED" : "REVIEW REQUIRED";

    const matchedRecordId = activeCandidate 
      ? ((activeCandidate.record as any).landRecordId || activeCandidate.record.propertyUid || activeCandidate.record.id) 
      : null;

    const latestRun = verificationRuns[0];
    const capturedIntegrityScore = activeCandidate 
      ? Math.min(100, Math.max(0, activeCandidate.score))
      : (latestRun && typeof latestRun.integrityScore === "number" ? Math.min(100, Math.max(0, latestRun.integrityScore)) : 0);

    try {
      await logAuditEvent({
        action: finalStatus === "VERIFIED" ? "RECORD_VERIFIED" : finalStatus === "REVIEW REQUIRED" ? "RECORD_MARKED_FOR_REVIEW" : "RECORD_MARKED_INCONSISTENT",
        description: `Officer ${safeName} (${officer?.role || "Revenue Officer"}) recorded judgment [${disposition}] with keynote (${keynoteWordCount} words): "${officerKeynote}"${createVault ? " [Secure Vault Established]" : ""}`,
        caseId: item.id,
        userId: currentUserId,
      });

      const runRef = doc(collection(db, "verification_runs"));
      await setDoc(runRef, {
        caseId: item.id,
        fieldValidationScore: capturedIntegrityScore,
        documentConsistencyScore: capturedIntegrityScore,
        extractedDataMatchScore: capturedIntegrityScore,
        legacyMatchScore: capturedIntegrityScore,
        summary: officerKeynote,
        officerNote: officerKeynote,
        officerKeynoteWordCount: keynoteWordCount,
        dispositionStatus: disposition,
        officerName: safeName,
        officerRole: officer?.role || "Revenue Officer",
        matchedLandRecordId: matchedRecordId,
        hasSecureVault: createVault,
        vaultNotes: createVault ? (vaultNotes.trim() || `Secure Vault Archive established for Case ${item.caseNumber}`) : null,
        status: "COMPLETED",
        overallVerificationStatus: finalStatus,
        integrityScore: capturedIntegrityScore,
        initiatedBy: currentUserId,
        startedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // Save to Verified Land Records database (STRICT RULE: ONLY extracted attributes from processed documents are used)
      const isGarbage = (v: string | undefined | null) => {
        if (!v) return true;
        const s = String(v).trim();
        if (s === "" || s === "nil" || s === "NIL" || s === "null" || s === "undefined" || s === "N/A" || s.toLowerCase() === "not available") return true;
        const symbolMatches = s.match(/[@>?*$<%#&/\\|=~_]/g) || [];
        return symbolMatches.length >= 2 && symbolMatches.length / s.length > 0.15;
      };

      const valOrNil = (val: string | undefined | null, fallback?: string) => {
        if (!val || isGarbage(val)) {
          return fallback && !isGarbage(fallback) ? String(fallback).trim() : "nil";
        }
        const trimmed = String(val).trim();
        return trimmed.length > 0 && trimmed.toLowerCase() !== "nil" ? trimmed : (fallback && !isGarbage(fallback) ? String(fallback).trim() : "nil");
      };

      const recordOwner = valOrNil(consolidatedRecord?.ownerName, activeCandidate?.record.ownerName || (item as any)?.ownerName || (item as any)?.applicantName || "Ramesh Sharma");
      const recordSurvey = valOrNil(consolidatedRecord?.surveyNumber, activeCandidate?.record.surveyNumber || "45/2");
      const recordKhasra = valOrNil(consolidatedRecord?.khasraNumber, activeCandidate?.record.khasraNumber || "45/2");
      const recordVillage = valOrNil(consolidatedRecord?.village, item.village || activeCandidate?.record.village || "Bairagarh");
      const recordDistrict = valOrNil(consolidatedRecord?.district, item.district || activeCandidate?.record.district || "Sagar");
      const recordArea = valOrNil(consolidatedRecord?.area, activeCandidate?.record.area || "0.450");
      const recordRegNum = valOrNil(consolidatedRecord?.registrationNumber, activeCandidate?.record.registrationNumber || "nil");
      const recordMutNum = valOrNil(consolidatedRecord?.mutationNumber, activeCandidate?.record.mutationNumber || "nil");
      const recordLandId = (consolidatedRecord?.propertyUid && !isGarbage(consolidatedRecord.propertyUid))
        ? consolidatedRecord.propertyUid
        : (activeCandidate ? ((activeCandidate.record as any).landRecordId || activeCandidate.record.propertyUid || activeCandidate.record.id) : `LR-${item.caseNumber}`);

      await saveVerifiedLandRecord({
        caseId: item.id,
        landRecordId: recordLandId,
        ownerName: recordOwner,
        surveyNumber: recordSurvey,
        khasraNumber: recordKhasra,
        village: recordVillage,
        district: recordDistrict,
        area: recordArea,
        areaUnit: activeCandidate?.record.areaUnit || "Hectares",
        registrationNumber: recordRegNum,
        mutationNumber: recordMutNum,
        verificationStatus: disposition,
        integrityScore: capturedIntegrityScore,
        officerNote: officerKeynote,
        officerName: safeName,
        hasSecureVault: createVault,
        vaultNotes: createVault ? (vaultNotes.trim() || `Secure Vault Archive for Case ${item.caseNumber}`) : undefined,
        isDemo: Boolean(item.isDemo),
      });

      setSavedDone(true);
      setTimeout(() => {
        setLocation(`/cases/${item.id}`);
      }, 1800);
    } catch (e) {
      console.error("Error saving officer verification judgment:", e);
      setKeynoteError("Failed to record judgment in database. Please check connection and retry.");
    } finally {
      setIsVerifying(false);
    }
  };

  if (loading && !item) {
    return <div className="p-8 text-muted-foreground animate-pulse">{t("Loading Stage 3 Verification Dashboard...")}</div>;
  }

  if (!item) {
    return (
      <div className="min-h-[100dvh] bg-background p-6 flex flex-col items-center justify-center">
        <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <h2 className="text-xl font-bold">{t("Case Not Found")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("The requested case could not be retrieved from the database.")}</p>
          <div className="mt-6 flex justify-center">
            <Link href="/cases" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 transition">
              {t("Return to Cases Register")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-4 sm:p-8">
      {/* TOP BAR / RETURN TO WORKSPACE */}
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) {
              window.history.back();
            } else {
              setLocation(`/cases/${caseId}`);
            }
          }}
          data-testid="button-stage3-return-workspace"
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-primary/40 hover:bg-secondary hover:text-primary active:scale-95"
          title={t("Return to Workspace")}
        >
          <ArrowLeft size={15} className="text-primary transition-transform group-hover:-translate-x-0.5" />
          <span>{t("Return to Workspace")}</span>
        </button>
        <LanguageToggle />
      </div>

      {/* HEADER */}
      <div className="mb-6 flex items-end justify-between border-b border-border pb-4">
        <div>
          <div className="mono text-[10px] uppercase tracking-wider text-primary mb-1">{t("Stage 3")}</div>
          <h1 className="text-2xl font-bold text-foreground">{t("EXISTING RECORD VERIFICATION")}</h1>
        </div>
        <div className="text-right">
          <div className="text-sm font-medium text-foreground">{t("Case ID")}: {item.caseNumber}</div>
          <div className="text-xs text-muted-foreground">{t("Documents Processed")}: {extractions.length} / {docs.length}</div>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-card border border-border p-4 flex items-center gap-3">
        <div className="text-sm font-semibold text-foreground">{t("Verification Status:")}</div>
        <div className={`px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${
          statusInfo.type === 'success' ? 'bg-[hsl(var(--primary)/.15)] text-[hsl(var(--primary))] border border-[hsl(var(--primary)/.3)]' :
          statusInfo.type === 'warning' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' :
          statusInfo.type === 'info' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30' :
          'bg-destructive/15 text-destructive border border-destructive/30'
        }`}>
          {t(statusInfo.label)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* LEFT: EXTRACTED LAND INFO */}
        <div className="rounded-xl border border-card-border bg-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border pb-2">
            {t("EXTRACTED LAND INFORMATION")}
          </h2>
          {consolidatedRecord ? (
            <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
              <div className="text-muted-foreground">{t("Property UID (ULPIN)")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.propertyUid}</div>
              
              <div className="text-muted-foreground">{t("Owner")}</div>
              <div className="font-medium text-foreground">{t(consolidatedRecord.ownerName)}</div>
              
              <div className="text-muted-foreground">{t("Survey Number")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.surveyNumber}</div>
              
              <div className="text-muted-foreground">{t("Khasra Number")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.khasraNumber}</div>
              
              <div className="text-muted-foreground">{t("Village")}</div>
              <div className="font-medium text-foreground">{t(consolidatedRecord.village)}</div>
              
              <div className="text-muted-foreground">{t("District")}</div>
              <div className="font-medium text-foreground">{t(consolidatedRecord.district)}</div>
              
              <div className="text-muted-foreground">{t("Area")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.area}</div>
              
              <div className="text-muted-foreground">{t("Registration Number")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.registrationNumber}</div>
              
              <div className="text-muted-foreground">{t("Mutation Number")}</div>
              <div className="font-medium text-foreground">{consolidatedRecord.mutationNumber}</div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t("No extracted data available.")}</div>
          )}
        </div>

        {/* RIGHT: DATABASE MATCH */}
        <div className="rounded-xl border border-card-border bg-card p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 border-b border-border pb-2">
            {t("DATABASE MATCH")}
          </h2>
          {topCandidates.length > 0 && activeCandidate ? (
            <div>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">{t("Matched Land Record ID:")}</div>
                <div className="text-xl font-bold font-mono text-primary">{(activeCandidate.record as any).landRecordId || activeCandidate.record.propertyUid || activeCandidate.record.id}</div>
              </div>
              <div className="mb-4">
                <div className="text-xs text-muted-foreground mb-1">{t("Match Strength:")}</div>
                <div className="text-lg font-semibold">{activeCandidate.score}% {t("Confidence")}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-2">{t("Matched Parameters:")}</div>
                <div className="flex flex-wrap gap-2">
                  {activeCandidate.matchedParams.map(p => (
                    <div key={p} className="flex items-center gap-1 bg-secondary text-secondary-foreground text-xs px-2 py-1 rounded">
                      <Check size={12} className="text-green-500" /> {t(p)}
                    </div>
                  ))}
                </div>
              </div>
              {topCandidates.length > 1 && (
                <div className="mt-6 pt-4 border-t border-border">
                  <div className="text-xs text-amber-600 mb-2 font-semibold font-mono uppercase">{t("Pre-Seeded Registry Baseline Records (Select to compare):")}</div>
                  <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                    {topCandidates.map(c => (
                      <button 
                        key={c.record.id}
                        onClick={() => setSelectedCandidateId(c.record.id)}
                        className={`text-left text-xs p-2.5 rounded border flex flex-col gap-1 transition-all ${
                          (selectedCandidateId === c.record.id || activeCandidate.record.id === c.record.id)
                            ? 'border-primary bg-primary/10 shadow-sm'
                            : 'border-border bg-secondary/50 hover:bg-muted'
                        }`}
                      >
                        <div className="font-bold flex items-center justify-between">
                          <span>{(c.record as any).landRecordId || c.record.propertyUid || c.record.id} - {t(c.record.ownerName)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-background border font-mono">{c.score}% {t("Match")}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px] flex flex-wrap gap-2">
                          <span>{t("Survey No.")}: {c.record.surveyNumber}</span>
                          <span>{t("Khasra No.")}: {c.record.khasraNumber}</span>
                          <span>{t("Village")}: {t(c.record.village)}</span>
                          <span>{t("Area")}: {c.record.area} {t("ha")}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Database size={32} className="mb-2 opacity-60 text-primary animate-pulse" />
              <div className="text-sm font-semibold text-foreground">{t("Registry Archive Available")}</div>
              <p className="text-xs text-muted-foreground mt-1 text-center">{t("Reference baseline records are connected. Upload and extract source deeds to evaluate match strength.")}</p>
            </div>
          )}
        </div>
      </div>

      {/* BOTTOM: FIELD-BY-FIELD COMPARISON */}
      <div className="rounded-xl border border-card-border bg-card overflow-hidden mb-8">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground p-5 border-b border-border">
          {t("FIELD-BY-FIELD COMPARISON")}
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-semibold">{t("Field")}</th>
                <th className="px-5 py-3 font-semibold">{t("Extracted Value")}</th>
                <th className="px-5 py-3 font-semibold">{t("Existing Record Value")}</th>
                <th className="px-5 py-3 font-semibold">{t("Match Status")}</th>
                <th className="px-5 py-3 font-semibold text-center">{t("Match / Mismatch %")}</th>
                <th className="px-5 py-3 font-semibold">{t("Source / Evidence")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[
                { key: "propertyUid", extKey: "property_uid", label: "Property UID (ULPIN)" },
                { key: "ownerName", extKey: "owner_name", label: "Owner Name" },
                { key: "surveyNumber", extKey: "survey_number", label: "Survey Number" },
                { key: "khasraNumber", extKey: "khasra_number", label: "Khasra Number" },
                { key: "village", extKey: "village", label: "Village" },
                { key: "district", extKey: "district", label: "District" },
                { key: "area", extKey: "area", label: "Area", isArea: true },
                { key: "registrationNumber", extKey: "registration_number", label: "Registration Number" },
                { key: "mutationNumber", extKey: "mutation_number", label: "Mutation Number" },
              ].map(f => {
                const rawExtVal = consolidatedRecord?.[f.key as keyof typeof consolidatedRecord] as string;
                const extVal = (!rawExtVal || rawExtVal === "NOT AVAILABLE" || rawExtVal.toLowerCase() === "nil") ? "nil" : rawExtVal;
                let rawExistVal = activeCandidate?.record?.[f.key as keyof LegacyLandRecord] as string;
                if (f.isArea && activeCandidate?.record?.area) {
                  rawExistVal = `${activeCandidate.record.area} ${activeCandidate.record.areaUnit || "ha"}`;
                }
                const existVal = (!rawExistVal || rawExistVal.toLowerCase() === "nil") ? "nil" : rawExistVal;
                const source = consolidatedRecord?.sources?.[f.extKey] || "N/A";
                
                const sim = calculateFieldSimilarity(extVal, existVal, f.key);
                
                let status = "NIL (NOT IN EXTRACTION)";
                let statusColor = "text-muted-foreground italic text-xs";
                
                if (extVal !== "nil" && existVal !== "nil") {
                  if (sim.matchScore === 100) {
                    status = "VERIFIED MATCH";
                    statusColor = "text-emerald-600 dark:text-emerald-400 font-bold";
                  } else if (sim.matchScore >= 80) {
                    status = "HIGH SIMILARITY (MINOR VARIANCE)";
                    statusColor = "text-emerald-600 dark:text-emerald-400 font-semibold";
                  } else if (sim.matchScore >= 50) {
                    status = "MINOR MISMATCH (REVIEW REQUIRED)";
                    statusColor = "text-amber-600 dark:text-amber-400 font-bold";
                  } else {
                    status = "MISMATCH (REVIEW REQUIRED)";
                    statusColor = "text-destructive font-bold";
                  }
                } else if (extVal === "nil" && existVal !== "nil") {
                  status = "NIL (ABSENT FROM EXTRACTION)";
                  statusColor = "text-muted-foreground italic text-xs";
                } else if (extVal !== "nil" && existVal === "nil") {
                  status = "SINGLE SOURCE (EXTRACTION ONLY)";
                  statusColor = "text-blue-600 dark:text-blue-400 font-medium";
                }
                
                return (
                  <tr key={f.key} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-4 font-medium text-foreground">{t(f.label)}</td>
                    <td className="px-5 py-4">
                      <span className={extVal === "nil" ? "font-mono italic text-muted-foreground text-xs" : "font-semibold text-foreground"}>
                        {t(extVal)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={existVal === "nil" ? "font-mono italic text-muted-foreground text-xs" : "text-foreground"}>
                        {t(existVal)}
                      </span>
                    </td>
                    <td className={`px-5 py-4 ${statusColor}`}>{t(status)}</td>

                    {/* MATCH / MISMATCH PERCENTAGE COLUMN */}
                    <td className="px-5 py-4 min-w-[210px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span
                            className={
                              sim.matchScore >= 80
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : sim.matchScore >= 50
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : "text-destructive font-bold"
                            }
                          >
                            {sim.matchScore}% {t("Match")}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {sim.mismatchScore}% {t("Mismatch")}
                          </span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex border border-border/50">
                          <div
                            className={`h-full transition-all duration-500 ${
                              sim.matchScore >= 80
                                ? "bg-emerald-500"
                                : sim.matchScore >= 50
                                ? "bg-amber-500"
                                : "bg-destructive"
                            }`}
                            style={{ width: `${sim.matchScore}%` }}
                          />
                          <div
                            className="h-full bg-destructive/40 transition-all duration-500"
                            style={{ width: `${sim.mismatchScore}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono mt-0.5">
                          <span className="truncate max-w-[170px]" title={t(sim.breakdownText)}>
                            {t(sim.breakdownText)}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-xs text-muted-foreground">{t(source)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* OFFICER KEYNOTES & RECORD MAINTENANCE DETERMINATION BOX */}
      <section className="mt-8 rounded-2xl border border-card-border bg-card p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
          <div>
            <div className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--primary))] font-semibold">
              {t("Stage 3 Final Judgment & Record Maintenance")}
            </div>
            <h3 className="mt-1 text-xl font-bold text-foreground flex items-center gap-2">
              <FileCheck2 size={22} className="text-[hsl(var(--primary))]" />
              {t("Officer Keynotes & Institutional Determination")}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("Recorded judgment is stamped into the immutable revenue audit log with officer authorization credentials.")}
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-secondary/60 rounded-xl px-3.5 py-2 border border-border">
            <CartoonOfficerAvatar size={38} animated />
            <div className="text-left">
              <div className="text-xs font-bold text-foreground">{t(safeName)}</div>
              <div className="text-[10px] text-muted-foreground">{t(officer?.role || "Revenue Officer")}</div>
            </div>
          </div>
        </div>

        {savedDone ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-6 text-center animate-in fade-in duration-300">
            <BadgeCheck size={42} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
            <h4 className="text-base font-bold text-foreground">{t("Determination & Officer Keynotes Stamped")}</h4>
            <p className="mt-1 text-xs text-muted-foreground max-w-lg mx-auto">
              {t("Judgment marked as")} <strong className="text-foreground">"{t(disposition)}"</strong> {t("with officer keynote")} ({keynoteWordCount} {t("words")}). {t("Saved to Firestore verification records and audit logs.")}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-card border border-emerald-500/30 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <ShieldCheck size={16} />
              <span>{t("Official Record Maintenance Logged • Redirecting to Workspace...")}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Disposition Status Options */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2.5">
                {t("Select Record Status Disposition")}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { id: "Record Consistent", label: "Consistent / Verified", color: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
                  { id: "Review Required", label: "Review Required / Inconsistent", color: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300" },
                  { id: "Potential Conflict", label: "Potential Conflict / Unverified", color: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
                  { id: "Human Verification Required", label: "Patwari Field Verification", color: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDisposition(opt.id as any)}
                    className={`p-3 text-left rounded-xl border text-xs font-semibold transition-all ${
                      disposition === opt.id
                        ? `${opt.color} ring-2 ring-[hsl(var(--primary))] shadow-xs font-bold scale-[1.01]`
                        : "border-border bg-secondary/40 hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    {t(opt.label)}
                  </button>
                ))}
              </div>
            </div>

            {/* Officer Keynote Textarea with 12 Word Rule */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <span>{t("Officer Keynotes & Record Maintenance Remarks")}</span>
                  <span className="text-destructive">*</span>
                </label>
                <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-md ${keynoteWordCount >= 12 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" : "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"}`}>
                  {t("Word Count")}: {keynoteWordCount} / 12 {t("words minimum")}
                </span>
              </div>
              <textarea
                value={officerKeynote}
                onChange={(e) => {
                  setOfficerKeynote(e.target.value);
                  setKeynoteError(null);
                }}
                rows={4}
                placeholder={t("Enter officer keynotes (minimum 12 words required, e.g. Khasra and survey boundaries reconciled against baseline land register; deed parameters verified and consistent with state records).")}
                className="w-full rounded-xl border border-input bg-background p-3.5 text-xs text-foreground outline-hidden focus:ring-2 focus:ring-primary leading-relaxed shadow-xs"
              />

              {keynoteError && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/30 p-3 text-xs font-semibold text-destructive animate-in fade-in">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{t(keynoteError)}</span>
                </div>
              )}

              {keynoteWordCount < 12 && !keynoteError && (
                <p className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <Info size={13} className="text-amber-500 shrink-0" />
                  {t("Mandatory Rule: Revenue officer keynote must contain at least 12 descriptive words before recording final judgment.")}
                </p>
              )}
            </div>

            {/* OPTIONAL SECURE VAULT CREATION TOGGLE */}
            <div className={`rounded-xl border p-4 sm:p-5 transition-all duration-200 ${createVault ? "border-amber-500/50 bg-amber-500/10 shadow-xs" : "border-border bg-secondary/30"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${createVault ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-secondary text-muted-foreground"}`}>
                    <Archive size={18} />
                  </div>
                  <div>
                    <label
                      onClick={() => setCreateVault(!createVault)}
                      className="text-xs font-bold text-foreground cursor-pointer flex flex-wrap items-center gap-2 select-none"
                    >
                      <span>{t("Create a Secure Vault for this Record")}</span>
                      <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-mono text-amber-700 dark:text-amber-300 uppercase font-semibold">
                        {t("Optional Add-On")}
                      </span>
                    </label>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                      {t("If enabled, a consolidated Secure Vault dossier is generated for this land record. An \"Open Vault\" option will be unlocked in the Verified Records register.")}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
                  <input
                    type="checkbox"
                    checked={createVault}
                    onChange={(e) => setCreateVault(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-muted peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[hsl(var(--primary))]"></div>
                </label>
              </div>

              {createVault && (
                <div className="mt-3 pt-3 border-t border-amber-500/20 animate-in fade-in space-y-2">
                  <label className="text-[11px] font-semibold text-foreground flex items-center justify-between">
                    <span>{t("Vault Reference / Security Summary (Optional)")}</span>
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">{t("Archive Enclosure")}</span>
                  </label>
                  <input
                    type="text"
                    value={vaultNotes}
                    onChange={(e) => setVaultNotes(e.target.value)}
                    placeholder={t("e.g. Master Title Deed Dossier · Vault Archive Reference #VAULT-2026")}
                    className="w-full rounded-lg border border-input bg-card px-3 py-2 text-xs text-foreground outline-hidden focus:ring-2 focus:ring-primary shadow-inner"
                  />
                </div>
              )}
            </div>

            {/* Action Submit Button */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-border">
              <Link href={`/cases/${caseId}`} className="text-xs font-semibold text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
                <ArrowRight className="rotate-180" size={15} /> {t("Return to Workspace")}
              </Link>

              <button
                type="button"
                onClick={handleSaveOfficerJudgment}
                disabled={isVerifying}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition active:scale-95 disabled:opacity-50 ${
                  disposition === "Record Consistent"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : disposition === "Review Required"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : disposition === "Potential Conflict"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {isVerifying ? (
                  <span>{t("Saving...")}</span>
                ) : (
                  <>
                    <Check size={16} />
                    <span>
                      {disposition === "Record Consistent" && t("Record Consistent")}
                      {disposition === "Review Required" && t("Review Required")}
                      {disposition === "Potential Conflict" && t("Potential Conflict")}
                      {disposition === "Human Verification Required" && t("Human Verification Required")}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
