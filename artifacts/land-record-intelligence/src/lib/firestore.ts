import { db, handleFirestoreError, OperationType } from "./firebase";
import { deleteDocumentBlob } from "./idb-storage";
import { multiplexSubscription, getCachedDoc, invalidateDocCache } from "./firestore-cache";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
  writeBatch,
  limit,
} from "./firestore-tracked";
import type {
  Case,
  CaseDocument,
  DocumentExtraction,
  ExtractedField,
  LegacyLandRecord,
  VerificationRun,
  VerificationFieldResult,
  OwnershipHistory,
  VerifiedLandRecord,
  ProcessingStep,
  DashboardSummary,
  DocumentType,
  VerificationStatus,
  AadhaarVerificationResult,
} from "./types";
import { DEV_OFFICER } from "./auth";
import { logAuditEvent } from "./audit";
import { DEFAULT_LEGACY_RECORDS } from "./seed-data";

// ============================================================================
// CASES
// ============================================================================

export function subscribeCases(
  onUpdate: (cases: Case[]) => void,
  includeDemo: boolean = true
) {
  return multiplexSubscription<Case[]>(
    `cases_list_${includeDemo}`,
    (publish) => {
      try {
        const casesCol = collection(db, "cases");
        // Bounded query with limit(50) prevents unbounded O(N) database scans
        const q = query(casesCol, orderBy("createdAt", "desc"), limit(50));
        return onSnapshot(
          q,
          (snap) => {
            const list: Case[] = [];
            snap.forEach((d) => {
              const data = d.data();
              const isDemo = Boolean(data.isDemo) || d.id.startsWith("demo-") || data.caseNumber === "LA-2026-00027";
              if (includeDemo || !isDemo) {
                list.push({
                  id: d.id,
                  ...data,
                  isDemo: isDemo,
                } as Case);
              }
            });
            publish(list);
          },
          (err) => {
            console.warn("subscribeCases notice:", err?.message || err);
            publish([]);
          }
        );
      } catch (err) {
        console.warn("subscribeCases init notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export async function getCase(caseIdOrNumber: string): Promise<Case | null> {
  return getCachedDoc<Case>(`case_doc_${caseIdOrNumber}`, async () => {
    try {
      // Check by doc ID
      const ref = doc(db, "cases", caseIdOrNumber);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as Case;
      }

      // Otherwise check by caseNumber
      const q = query(collection(db, "cases"), where("caseNumber", "==", caseIdOrNumber), limit(1));
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        const d = querySnap.docs[0];
        return { id: d.id, ...d.data() } as Case;
      }
      return null;
    } catch (err) {
      console.warn(`getCase lookup notice for ${caseIdOrNumber}:`, err);
      return null;
    }
  });
}

export function subscribeCase(
  caseIdOrNumber: string,
  onUpdate: (c: Case | null) => void
) {
  if (!caseIdOrNumber || typeof caseIdOrNumber !== "string" || !caseIdOrNumber.trim()) {
    onUpdate(null);
    return () => {};
  }
  return multiplexSubscription<Case | null>(
    `case_single_${caseIdOrNumber}`,
    (publish) => {
      try {
        const docRef = doc(db, "cases", caseIdOrNumber);
        return onSnapshot(
          docRef,
          async (snap) => {
            if (snap.exists()) {
              publish({ id: snap.id, ...snap.data() } as Case);
            } else {
              publish(null);
            }
          },
          (err) => {
            console.warn("subscribeCase listener notice:", err?.message || err);
            publish(null);
          }
        );
      } catch (err) {
        console.warn("subscribeCase init notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export async function createCase(data: {
  projectName: string;
  district: string;
  village: string;
  description?: string;
  acquisitionReference?: string;
  isDemo?: boolean;
}): Promise<Case> {
  try {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const caseNumber = `LA-${year}-${randomSuffix}`;
    const newDocRef = doc(collection(db, "cases"));

    const caseData: Omit<Case, "id"> = {
      caseNumber,
      projectName: data.projectName,
      district: data.district,
      village: data.village,
      description: data.description || "",
      acquisitionReference: data.acquisitionReference || "",
      status: "DRAFT",
      createdBy: DEV_OFFICER.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isDemo: Boolean(data.isDemo),
      documentCount: 0,
    };

    await setDoc(newDocRef, caseData);

    await logAuditEvent({
      action: "CASE_CREATED",
      description: `Established new intake case ${caseNumber} for ${data.projectName}`,
      caseId: newDocRef.id,
      metadata: { caseNumber, district: data.district, village: data.village },
    });

    return {
      id: newDocRef.id,
      ...caseData,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "cases");
  }
}

export async function updateCaseStatus(caseId: string, status: Case["status"]): Promise<void> {
  try {
    const ref = doc(db, "cases", caseId);
    await updateDoc(ref, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `cases/${caseId}`);
  }
}

export async function deleteCasePermanently(caseId: string): Promise<void> {
  if (!caseId) return;

  try {
    let targetDocId = caseId;
    let caseNumber = "";

    // Try reading case doc metadata if reads quota allows
    try {
      const caseDocRef = doc(db, "cases", caseId);
      const caseSnap = await getDoc(caseDocRef);
      if (caseSnap.exists()) {
        caseNumber = (caseSnap.data() as any)?.caseNumber || "";
      }
    } catch (e) {
      console.warn("Could not fetch case details prior to deletion (quota or network):", e);
    }

    // 1. Delete main case document immediately
    try {
      await deleteDoc(doc(db, "cases", targetDocId));
    } catch (e) {
      console.warn(`Error directly deleting case doc ${targetDocId}:`, e);
    }

    if (caseId !== targetDocId) {
      try {
        await deleteDoc(doc(db, "cases", caseId));
      } catch {}
    }

    // Helper to query and delete all documents in a collection matching a where clause
    const deleteByQuery = async (colName: string, field: string, val: string) => {
      if (!val) return;
      try {
        const q = query(collection(db, colName), where(field, "==", val));
        const snap = await getDocs(q);
        const docs = snap.docs;
        if (docs.length === 0) return;
        for (let i = 0; i < docs.length; i += 400) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 400);
          chunk.forEach((d) => batch.delete(d.ref));
          await batch.commit();
        }
      } catch (e) {
        console.warn(`Notice deleting from ${colName} where ${field}==${val}:`, e);
      }
    };

    // 2. Best-effort cascading purge of child documents & indexedDB
    try {
      const docIds: string[] = [];
      try {
        const docsSnap = await getDocs(query(collection(db, "documents"), where("caseId", "==", targetDocId)));
        docsSnap.forEach((d) => {
          docIds.push(d.id);
          deleteDocumentBlob(d.id).catch(() => {});
        });
      } catch {}

      for (const docId of docIds) {
        await deleteByQuery("processing_steps", "documentId", docId);
        await deleteByQuery("document_extractions", "documentId", docId);
      }

      await deleteByQuery("documents", "caseId", targetDocId);
      await deleteByQuery("document_extractions", "caseId", targetDocId);
      await deleteByQuery("verification_runs", "caseId", targetDocId);
      await deleteByQuery("verification_field_results", "caseId", targetDocId);
      await deleteByQuery("verified_land_records", "caseId", targetDocId);
      await deleteByQuery("legacy_land_records", "caseId", targetDocId);
      await deleteByQuery("ownership_histories", "caseId", targetDocId);
      await deleteByQuery("audit_logs", "caseId", targetDocId);
    } catch (e) {
      console.warn("Notice during cascading subcollection cleanup:", e);
    }
  } catch (err) {
    console.error("deleteCasePermanently warning:", err);
  }
}

// ============================================================================
// DOCUMENTS
// ============================================================================

export function subscribeCaseDocuments(
  caseId: string,
  onUpdate: (docs: CaseDocument[]) => void
) {
  if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<CaseDocument[]>(
    `case_documents_${caseId}`,
    (publish) => {
      let unsubFallback: (() => void) | null = null;
      try {
        const q = query(
          collection(db, "documents"),
          where("caseId", "==", caseId),
          orderBy("serialNumber", "asc")
        );
        const unsubMain = onSnapshot(
          q,
          (snap) => {
            const docs: CaseDocument[] = [];
            snap.forEach((d) => {
              docs.push({ id: d.id, ...d.data() } as CaseDocument);
            });
            publish(docs);
          },
          (err) => {
            console.warn("subscribeCaseDocuments notice:", err?.message || err);
            // Fallback without composite index if necessary
            const simpleQ = query(collection(db, "documents"), where("caseId", "==", caseId));
            unsubFallback = onSnapshot(simpleQ, (s) => {
              const list: CaseDocument[] = [];
              s.forEach((d) => list.push({ id: d.id, ...d.data() } as CaseDocument));
              list.sort((a, b) => a.serialNumber - b.serialNumber);
              publish(list);
            });
          }
        );
        return () => {
          unsubMain();
          if (unsubFallback) unsubFallback();
        };
      } catch (err) {
        console.warn("subscribeCaseDocuments init notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export async function createCaseDocument(params: {
  id?: string;
  caseId: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  fileUrl?: string;
  fileSize: number;
  mimeType: string;
  isDemo?: boolean;
  serialNumber?: number;
}): Promise<CaseDocument> {
  try {
    // Determine next serial number if not provided
    let serialNumber = params.serialNumber;
    if (!serialNumber) {
      const existingSnap = await getDocs(
        query(collection(db, "documents"), where("caseId", "==", params.caseId))
      );
      serialNumber = existingSnap.size + 1;
    }

    const newDocRef = params.id ? doc(db, "documents", params.id) : doc(collection(db, "documents"));
    const docData: Omit<CaseDocument, "id"> = {
      caseId: params.caseId,
      documentType: params.documentType,
      fileName: params.fileName,
      storagePath: params.storagePath,
      fileUrl: params.fileUrl || "",
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      serialNumber,
      status: "UPLOADED",
      uploadedBy: DEV_OFFICER.id,
      uploadedAt: serverTimestamp(),
      processedAt: null,
      errorMessage: null,
      isDemo: Boolean(params.isDemo),
    };

    await setDoc(newDocRef, docData);

    // Increment documentCount on case
    try {
      await updateDoc(doc(db, "cases", params.caseId), {
        documentCount: increment(1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }

    await logAuditEvent({
      action: "DOCUMENT_UPLOADED",
      description: `Uploaded source document #${serialNumber} (${params.fileName}) to case`,
      caseId: params.caseId,
      documentId: newDocRef.id,
      metadata: {
        fileName: params.fileName,
        documentType: params.documentType,
        fileSize: params.fileSize,
      },
    });

    return {
      id: newDocRef.id,
      ...docData,
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "documents");
  }
}

export async function deleteCaseDocument(documentId: string, caseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "documents", documentId));
    try {
      await updateDoc(doc(db, "cases", caseId), {
        documentCount: increment(-1),
        updatedAt: serverTimestamp(),
      });
    } catch {
      // ignore
    }
    await logAuditEvent({
      action: "DOCUMENT_DELETED",
      description: `Removed source document ${documentId} from case`,
      caseId,
      documentId,
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `documents/${documentId}`);
  }
}

// ============================================================================
// PROCESSING STEPS & EXTRACTIONS
// ============================================================================

export function subscribeProcessingSteps(
  documentId: string,
  onUpdate: (steps: ProcessingStep[]) => void
) {
  if (!documentId || typeof documentId !== "string" || !documentId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<ProcessingStep[]>(
    `proc_steps_${documentId}`,
    (publish) => {
      let unsubFallback: (() => void) | null = null;
      try {
        const q = query(
          collection(db, "processing_steps"),
          where("documentId", "==", documentId),
          orderBy("startedAt", "asc")
        );
        const unsubMain = onSnapshot(
          q,
          (snap) => {
            const steps: ProcessingStep[] = [];
            snap.forEach((d) => steps.push({ id: d.id, ...d.data() } as ProcessingStep));
            publish(steps);
          },
          () => {
            const simpleQ = query(
              collection(db, "processing_steps"),
              where("documentId", "==", documentId)
            );
            unsubFallback = onSnapshot(simpleQ, (s) => {
              const list: ProcessingStep[] = [];
              s.forEach((d) => list.push({ id: d.id, ...d.data() } as ProcessingStep));
              publish(list);
            });
          }
        );
        return () => {
          unsubMain();
          if (unsubFallback) unsubFallback();
        };
      } catch (err) {
        console.warn("subscribeProcessingSteps init notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeDocumentExtraction(
  documentId: string,
  onUpdate: (ext: DocumentExtraction | null) => void
) {
  if (!documentId || typeof documentId !== "string" || !documentId.trim()) {
    onUpdate(null);
    return () => {};
  }
  return multiplexSubscription<DocumentExtraction | null>(
    `doc_extraction_${documentId}`,
    (publish) => {
      try {
        const q = query(
          collection(db, "document_extractions"),
          where("documentId", "==", documentId),
          limit(1)
        );
        return onSnapshot(q, (snap) => {
          if (!snap.empty) {
            const d = snap.docs[0];
            publish({ id: d.id, ...d.data() } as DocumentExtraction);
          } else {
            publish(null);
          }
        });
      } catch (err) {
        console.warn("subscribeDocumentExtraction notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeCaseExtractions(
  caseId: string,
  onUpdate: (extractions: DocumentExtraction[]) => void
) {
  if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<DocumentExtraction[]>(
    `case_extractions_${caseId}`,
    (publish) => {
      try {
        const q = query(collection(db, "document_extractions"), where("caseId", "==", caseId), limit(50));
        return onSnapshot(q, (snap) => {
          const list: DocumentExtraction[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as DocumentExtraction));
          publish(list);
        });
      } catch (err) {
        console.warn("subscribeCaseExtractions notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export async function saveManualDocumentExtraction(
  documentId: string,
  caseId: string,
  documentType: DocumentType,
  fields: {
    owner_name?: string | null;
    khasra_number?: string | null;
    khata_number?: string | null;
    area?: string | null;
    area_unit?: string | null;
    village?: string | null;
    district?: string | null;
    state?: string | null;
    registration_number?: string | null;
    mutation_number?: string | null;
  }
): Promise<void> {
  const batch = writeBatch(db);

  // 1. Update the document status to COMPLETED
  const docRef = doc(db, "documents", documentId);
  batch.update(docRef, {
    status: "COMPLETED",
    documentType: documentType,
    errorMessage: null,
    processedAt: serverTimestamp(),
  });

  // 2. Format extraction payload
  const rawExtraction: any = {
    is_land_record: true,
    document_relevance: "LAND_RELATED",
    document_type: documentType,
    irrelevant_reason: null,
    property_uid: fields.khasra_number ? `PROP-${fields.khasra_number}` : null,
    owner_name: fields.owner_name || null,
    khasra_number: fields.khasra_number || null,
    khata_number: fields.khata_number || null,
    survey_number: fields.khasra_number || null,
    area: fields.area || null,
    area_unit: fields.area_unit || "Hectare",
    village: fields.village || null,
    district: fields.district || null,
    state: fields.state || "Madhya Pradesh",
    registration_number: fields.registration_number || null,
    mutation_number: fields.mutation_number || null,
    raw_ocr_summary: `Manual officer verification & field indexing confirmed for ${documentType}.`,
    confidence_score: 0.98,
    fields: {
      owner_name: { value: fields.owner_name || null, confidence: 0.98, status: fields.owner_name ? "FOUND" : "NOT_FOUND" },
      khasra_number: { value: fields.khasra_number || null, confidence: 0.98, status: fields.khasra_number ? "FOUND" : "NOT_FOUND" },
      khata_number: { value: fields.khata_number || null, confidence: 0.98, status: fields.khata_number ? "FOUND" : "NOT_FOUND" },
      survey_number: { value: fields.khasra_number || null, confidence: 0.98, status: fields.khasra_number ? "FOUND" : "NOT_FOUND" },
      area: { value: fields.area || null, confidence: 0.98, status: fields.area ? "FOUND" : "NOT_FOUND" },
      registration_number: { value: fields.registration_number || null, confidence: 0.98, status: fields.registration_number ? "FOUND" : "NOT_FOUND" },
      mutation_number: { value: fields.mutation_number || null, confidence: 0.98, status: fields.mutation_number ? "FOUND" : "NOT_FOUND" },
    },
  };

  // 3. Upsert document_extractions
  const extCol = collection(db, "document_extractions");
  const extQ = query(extCol, where("documentId", "==", documentId));
  const snap = await getDocs(extQ);

  if (!snap.empty) {
    batch.update(snap.docs[0].ref, {
      documentType,
      rawExtraction,
      overallConfidence: 0.98,
      model: "Officer Verified (Human-in-the-Loop Assist)",
      isLandRecord: true,
      updatedAt: serverTimestamp(),
    });
  } else {
    const newExtRef = doc(extCol);
    batch.set(newExtRef, {
      documentId,
      caseId,
      documentType,
      rawExtraction,
      overallConfidence: 0.98,
      model: "Officer Verified (Human-in-the-Loop Assist)",
      isLandRecord: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  // 4. Update case status to READY_FOR_VERIFICATION
  const caseRef = doc(db, "cases", caseId);
  batch.update(caseRef, {
    status: "READY_FOR_VERIFICATION",
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  await logAuditEvent({
    action: "FIELD_EXTRACTION_COMPLETED",
    description: `Officer indexed verified fields for document ${documentId} (${documentType})`,
    caseId,
    documentId,
    metadata: { fields, documentType, verifiedByOfficer: true },
  });
}

// ============================================================================
// LEGACY RECORDS & VERIFICATION
// ============================================================================

export function subscribeLegacyLandRecords(
  caseId: string,
  onUpdate: (records: LegacyLandRecord[]) => void
) {
  if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<LegacyLandRecord[]>(
    `legacy_records_${caseId}`,
    (publish) => {
      try {
        const q = query(collection(db, "legacy_land_records"), where("caseId", "==", caseId), limit(50));
        return onSnapshot(q, (snap) => {
          const list: LegacyLandRecord[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as LegacyLandRecord));
          publish(list);
        });
      } catch (err) {
        console.warn("subscribeLegacyLandRecords notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeAllLegacyLandRecords(
  onUpdate: (records: LegacyLandRecord[]) => void
) {
  return multiplexSubscription<LegacyLandRecord[]>(
    `all_legacy_records`,
    (publish) => {
      try {
        const q = query(collection(db, "legacy_land_records"), limit(50));
        return onSnapshot(
          q,
          (snap) => {
            const list: LegacyLandRecord[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as LegacyLandRecord));
            if (list.length === 0) {
              const fallback = DEFAULT_LEGACY_RECORDS.map((r) => ({
                id: r.landRecordId,
                ...r,
                caseId: "demo-la-2026-00027",
              })) as LegacyLandRecord[];
              publish(fallback);
            } else {
              publish(list);
            }
          },
          (err) => {
            console.warn("subscribeAllLegacyLandRecords notice:", err);
            const fallback = DEFAULT_LEGACY_RECORDS.map((r) => ({
              id: r.landRecordId,
              ...r,
              caseId: "demo-la-2026-00027",
            })) as LegacyLandRecord[];
            publish(fallback);
          }
        );
      } catch (err) {
        console.warn("subscribeAllLegacyLandRecords init notice:", err);
        const fallback = DEFAULT_LEGACY_RECORDS.map((r) => ({
          id: r.landRecordId,
          ...r,
          caseId: "demo-la-2026-00027",
        })) as LegacyLandRecord[];
        publish(fallback);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeVerificationRuns(
  caseId: string,
  onUpdate: (runs: VerificationRun[]) => void
) {
  if (!caseId || typeof caseId !== "string" || !caseId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<VerificationRun[]>(
    `verification_runs_${caseId}`,
    (publish) => {
      let unsubFallback: (() => void) | null = null;
      try {
        const q = query(
          collection(db, "verification_runs"),
          where("caseId", "==", caseId),
          orderBy("createdAt", "desc"),
          limit(20)
        );
        const unsubMain = onSnapshot(
          q,
          (snap) => {
            const list: VerificationRun[] = [];
            snap.forEach((d) => list.push({ id: d.id, ...d.data() } as VerificationRun));
            publish(list);
          },
          () => {
            const simpleQ = query(collection(db, "verification_runs"), where("caseId", "==", caseId), limit(20));
            unsubFallback = onSnapshot(simpleQ, (s) => {
              const list: VerificationRun[] = [];
              s.forEach((d) => list.push({ id: d.id, ...d.data() } as VerificationRun));
              publish(list);
            });
          }
        );
        return () => {
          unsubMain();
          if (unsubFallback) unsubFallback();
        };
      } catch (err) {
        console.warn("subscribeVerificationRuns notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeVerificationFieldResults(
  runId: string,
  onUpdate: (results: VerificationFieldResult[]) => void
) {
  if (!runId || typeof runId !== "string" || !runId.trim()) {
    onUpdate([]);
    return () => {};
  }
  return multiplexSubscription<VerificationFieldResult[]>(
    `field_results_${runId}`,
    (publish) => {
      try {
        const q = query(
          collection(db, "verification_field_results"),
          where("runId", "==", runId)
        );
        return onSnapshot(q, (snap) => {
          const list: VerificationFieldResult[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as VerificationFieldResult));
          publish(list);
        });
      } catch (err) {
        console.warn("subscribeVerificationFieldResults notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export function subscribeVerifiedLandRecords(
  onUpdate: (records: VerifiedLandRecord[]) => void,
  caseId?: string
) {
  const cacheKey = caseId ? `verified_records_${caseId}` : `verified_records_all`;
  return multiplexSubscription<VerifiedLandRecord[]>(
    cacheKey,
    (publish) => {
      let unsubFallback: (() => void) | null = null;
      try {
        let q = query(collection(db, "verified_land_records"), orderBy("createdAt", "desc"), limit(50));
        if (caseId) {
          q = query(
            collection(db, "verified_land_records"),
            where("caseId", "==", caseId),
            orderBy("createdAt", "desc"),
            limit(50)
          );
        }
        const unsubMain = onSnapshot(
          q,
          (snap) => {
            const list: VerifiedLandRecord[] = [];
            snap.forEach((d) => {
              const data = d.data();
              list.push({ id: d.id, ...data } as VerifiedLandRecord);
            });
            publish(list);
          },
          () => {
            const simpleQ = caseId
              ? query(collection(db, "verified_land_records"), where("caseId", "==", caseId), limit(50))
              : query(collection(db, "verified_land_records"), limit(50));
            unsubFallback = onSnapshot(simpleQ, (s) => {
              const list: VerifiedLandRecord[] = [];
              s.forEach((d) => {
                const data = d.data();
                list.push({ id: d.id, ...data } as VerifiedLandRecord);
              });
              publish(list);
            });
          }
        );
        return () => {
          unsubMain();
          if (unsubFallback) unsubFallback();
        };
      } catch (err) {
        console.warn("subscribeVerifiedLandRecords notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

export async function saveVerifiedLandRecord(record: {
  caseId: string;
  landRecordId: string;
  ownerName: string;
  surveyNumber: string;
  khasraNumber: string;
  village: string;
  district: string;
  area: string;
  areaUnit: string;
  registrationNumber?: string;
  registrationDate?: string;
  mutationNumber?: string;
  mutationDate?: string;
  verificationStatus: VerificationStatus;
  integrityScore: number;
  officerNote?: string;
  officerName?: string;
  hasSecureVault?: boolean;
  vaultNotes?: string;
  vaultCreatedAt?: any;
  isDemo?: boolean;
}): Promise<string> {
  try {
    const colRef = collection(db, "verified_land_records");
    const docRef = await addDoc(colRef, {
      ...record,
      hasSecureVault: Boolean(record.hasSecureVault),
      vaultNotes: record.vaultNotes || null,
      vaultCreatedAt: record.hasSecureVault ? serverTimestamp() : null,
      verifiedBy: DEV_OFFICER.id,
      verifiedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const statusMap: Record<VerificationStatus, Case["status"]> = {
      "Record Consistent": "VERIFIED",
      "Review Required": "MANUAL_REVIEW",
      "Potential Conflict": "INCONSISTENT",
      "Human Verification Required": "READY_FOR_VERIFICATION",
    };

    await updateCaseStatus(record.caseId, statusMap[record.verificationStatus] || "MANUAL_REVIEW");

    await logAuditEvent({
      action: "RECORD_VERIFIED",
      description: `Officer designated record ${record.landRecordId} as '${record.verificationStatus}' with score ${record.integrityScore}%${record.hasSecureVault ? " (Secure Vault Created)" : ""}`,
      caseId: record.caseId,
      metadata: {
        landRecordId: record.landRecordId,
        verificationStatus: record.verificationStatus,
        integrityScore: record.integrityScore,
        hasSecureVault: Boolean(record.hasSecureVault),
      },
    });

    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "verified_land_records");
  }
}

export async function getVerifiedLandRecord(id: string): Promise<VerifiedLandRecord | null> {
  return getCachedDoc<VerifiedLandRecord>(`vlr_${id}`, async () => {
    try {
      const snap = await getDoc(doc(db, "verified_land_records", id));
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as VerifiedLandRecord;
      }
      return null;
    } catch (err) {
      console.warn("getVerifiedLandRecord notice:", err);
      return null;
    }
  });
}

// ============================================================================
// DASHBOARD STATS
// ============================================================================

export function subscribeDashboardSummary(
  onUpdate: (summary: DashboardSummary) => void,
  includeDemo: boolean = false
) {
  return multiplexSubscription<DashboardSummary>(
    `dashboard_summary_${includeDemo}`,
    (publish) => {
      let latestCases: any[] = [];
      let latestDocs: any[] = [];
      let latestVerified: any[] = [];

      const computeAndPublish = () => {
        let totalCases = 0;
        let reviewCases = 0;
        for (const d of latestCases) {
          const isDemo = Boolean(d.isDemo) || d.id?.startsWith("demo-") || d.caseNumber === "LA-2026-00027";
          if (!isDemo) {
            totalCases++;
            if (d.status === "MANUAL_REVIEW" || d.status === "INCONSISTENT" || d.status === "READY_FOR_VERIFICATION") {
              reviewCases++;
            }
          }
        }

        let uploaded = 0;
        let processed = 0;
        for (const d of latestDocs) {
          const isDemo = Boolean(d.isDemo) || d.id?.startsWith("demo-") || d.caseId === "demo-la-2026-00027";
          if (!isDemo) {
            uploaded++;
            if (d.status === "COMPLETED") {
              processed++;
            }
          }
        }

        let verified = 0;
        let conflicts = 0;
        for (const d of latestVerified) {
          const isDemo = Boolean(d.isDemo) || d.id?.startsWith("demo-") || d.caseId === "demo-la-2026-00027";
          if (!isDemo) {
            if (d.verificationStatus === "Record Consistent") {
              verified++;
            }
            if (d.verificationStatus === "Potential Conflict" || d.verificationStatus === "Review Required") {
              conflicts++;
            }
          }
        }

        publish({
          totalCases,
          documentsUploaded: uploaded,
          documentsProcessed: processed,
          recordsVerified: verified,
          recordsRequiringReview: Math.max(reviewCases, conflicts),
          conflictsDetected: conflicts,
        });
      };

      try {
        const unsubCases = onSnapshot(
          query(collection(db, "cases"), limit(50)),
          (snap) => {
            latestCases = snap.docs.map((doc) => doc.data());
            computeAndPublish();
          },
          (err) => console.warn("subscribeDashboardSummary cases notice:", err)
        );

        const unsubDocs = onSnapshot(
          query(collection(db, "documents"), limit(50)),
          (snap) => {
            latestDocs = snap.docs.map((doc) => doc.data());
            computeAndPublish();
          },
          (err) => console.warn("subscribeDashboardSummary docs notice:", err)
        );

        const unsubVerified = onSnapshot(
          query(collection(db, "verified_land_records"), limit(50)),
          (snap) => {
            latestVerified = snap.docs.map((doc) => doc.data());
            computeAndPublish();
          },
          (err) => console.warn("subscribeDashboardSummary verified notice:", err)
        );

        return () => {
          unsubCases();
          unsubDocs();
          unsubVerified();
        };
      } catch (err) {
        console.warn("subscribeDashboardSummary init notice:", err);
        return () => {};
      }
    },
    onUpdate
  );
}

// ============================================================================
// AADHAAR PAPERLESS OFFLINE e-KYC VERIFICATION
// ============================================================================

export function subscribeAadhaarVerification(
  caseId: string,
  onUpdate: (result: AadhaarVerificationResult | null) => void
): () => void {
  let isMounted = true;

  // 1. Immediately query backend API for latest in-memory or persisted verification
  if (caseId) {
    fetch(`/api/aadhaar/status/${encodeURIComponent(caseId)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data?.success && data?.verification) {
          onUpdate(data.verification as AadhaarVerificationResult);
        }
      })
      .catch(() => {});
  }

  // 2. Attach Firestore listener for real-time sync with local cache
  try {
    const unsub = onSnapshot(
      doc(db, "aadhaar_verifications", caseId),
      (snap) => {
        if (isMounted) {
          if (snap.exists()) {
            onUpdate(snap.data() as AadhaarVerificationResult);
          }
        }
      },
      () => {
        // Fallback handled via backend API query
      }
    );
    return () => {
      isMounted = false;
      unsub();
    };
  } catch {
    return () => {
      isMounted = false;
    };
  }
}

export async function getAadhaarVerification(caseId: string): Promise<AadhaarVerificationResult | null> {
  // Try backend API first
  try {
    const res = await fetch(`/api/aadhaar/status/${encodeURIComponent(caseId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data?.success && data?.verification) {
        return data.verification as AadhaarVerificationResult;
      }
    }
  } catch {}

  try {
    const snap = await getDoc(doc(db, "aadhaar_verifications", caseId));
    if (snap.exists()) {
      return snap.data() as AadhaarVerificationResult;
    }
    return null;
  } catch {
    return null;
  }
}

export async function saveAadhaarVerification(
  caseId: string,
  verification: AadhaarVerificationResult
): Promise<void> {
  try {
    await setDoc(doc(db, "aadhaar_verifications", caseId), {
      ...verification,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Local persistence fallback
  }
}

