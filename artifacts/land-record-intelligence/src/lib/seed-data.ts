import { db } from "./firebase";
import { doc, getDoc, setDoc, serverTimestamp, collection, writeBatch } from "./firestore-tracked";
import { DEV_OFFICER } from "./auth";
import type { LegacyLandRecord } from "./types";

export const DEFAULT_LEGACY_RECORDS: Omit<LegacyLandRecord, "id">[] = [
  { landRecordId: "LR-000101", propertyUid: "ULPIN-112233445", ownerName: "Rajesh Verma", surveyNumber: "112/3", khasraNumber: "45/2", village: "Sehore", district: "Sehore", area: "1.85", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000102", propertyUid: "ULPIN-223344556", ownerName: "Neha Patel", surveyNumber: "118/4", khasraNumber: "62/2", village: "Ashta", district: "Sehore", area: "3.20", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000103", propertyUid: "ULPIN-334455667", ownerName: "Amit Sharma", surveyNumber: "203/1", khasraNumber: "91/5", village: "Ichhawar", district: "Sehore", area: "4.15", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000104", propertyUid: "ULPIN-445566778", ownerName: "Kavita Singh", surveyNumber: "145/2", khasraNumber: "78/1", village: "Budhni", district: "Sehore", area: "2.60", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000105", propertyUid: "ULPIN-987654321", ownerName: "Sanjay Sharma", surveyNumber: "156/7", khasraNumber: "73/4", village: "Mandideep", district: "Raisen", area: "2.75", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000106", propertyUid: "ULPIN-667788990", ownerName: "Pooja Verma", surveyNumber: "312/2", khasraNumber: "145/3", village: "Obedullaganj", district: "Raisen", area: "1.95", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000107", propertyUid: "ULPIN-778899001", ownerName: "Deepak Thakur", surveyNumber: "421/5", khasraNumber: "176/3", village: "Sultanpur", district: "Raisen", area: "5.10", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000108", propertyUid: "ULPIN-889900112", ownerName: "Anjali Soni", surveyNumber: "265/2", khasraNumber: "112/6", village: "Vidisha", district: "Vidisha", area: "2.95", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000109", propertyUid: "ULPIN-990011223", ownerName: "Mohit Yadav", surveyNumber: "178/4", khasraNumber: "84/2", village: "Gyaraspur", district: "Vidisha", area: "3.75", areaUnit: "Ha", status: "Active" },
  { landRecordId: "LR-000110", propertyUid: "ULPIN-001122334", ownerName: "Priya Mishra", surveyNumber: "229/1", khasraNumber: "103/7", village: "Basoda", district: "Vidisha", area: "2.40", areaUnit: "Ha", status: "Active" },
];

export async function ensureDemoDataSeeded(): Promise<void> {
  try {
    const demoCaseRef = doc(db, "cases", "demo-la-2026-00027");
    const snap = await getDoc(demoCaseRef);
    if (!snap.exists()) {
      const batch = writeBatch(db);

      // 1. Demo Case LA-2026-00027
      batch.set(demoCaseRef, {
        caseNumber: "LA-2026-00027",
        projectName: "Bhopal–Sehore Road Expansion",
        district: "Sehore",
        village: "Barkheda",
        description: "Priority corridor land acquisition intake for highway expansion. Requires title deed, khasra verification, and mutation cross-referencing.",
        acquisitionReference: "NHAI/MP/2026/04-A",
        status: "READY_FOR_VERIFICATION",
        createdBy: DEV_OFFICER.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDemo: true,
        documentCount: 3,
      });

      // 2. Demo Documents
      const doc1Ref = doc(db, "documents", "demo-doc-001");
      batch.set(doc1Ref, {
        caseId: "demo-la-2026-00027",
        documentType: "SALE_DEED",
        fileName: "sale_deed_ramesh_sharma.pdf",
        storagePath: "cases/demo-la-2026-00027/demo-doc-001/sale_deed_ramesh_sharma.pdf",
        fileUrl: "",
        fileSize: 2450000,
        mimeType: "application/pdf",
        serialNumber: 1,
        status: "COMPLETED",
        uploadedBy: DEV_OFFICER.id,
        uploadedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        errorMessage: null,
        isDemo: true,
      });

      const doc2Ref = doc(db, "documents", "demo-doc-002");
      batch.set(doc2Ref, {
        caseId: "demo-la-2026-00027",
        documentType: "KHASRA_RECORD",
        fileName: "khasra_record_barkheda_87_3.pdf",
        storagePath: "cases/demo-la-2026-00027/demo-doc-002/khasra_record_barkheda_87_3.pdf",
        fileUrl: "",
        fileSize: 1820000,
        mimeType: "application/pdf",
        serialNumber: 2,
        status: "COMPLETED",
        uploadedBy: DEV_OFFICER.id,
        uploadedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        errorMessage: null,
        isDemo: true,
      });

      const doc3Ref = doc(db, "documents", "demo-doc-003");
      batch.set(doc3Ref, {
        caseId: "demo-la-2026-00027",
        documentType: "MUTATION_RECORD",
        fileName: "mutation_order_45821.pdf",
        storagePath: "cases/demo-la-2026-00027/demo-doc-003/mutation_order_45821.pdf",
        fileUrl: "",
        fileSize: 980000,
        mimeType: "application/pdf",
        serialNumber: 3,
        status: "COMPLETED",
        uploadedBy: DEV_OFFICER.id,
        uploadedAt: serverTimestamp(),
        processedAt: serverTimestamp(),
        errorMessage: null,
        isDemo: true,
      });

      // 3. Document Extractions
      const ext1Ref = doc(db, "document_extractions", "demo-ext-001");
      batch.set(ext1Ref, {
        documentId: "demo-doc-001",
        caseId: "demo-la-2026-00027",
        documentType: "SALE_DEED",
        rawExtraction: {
          document_type: "SALE_DEED",
          owner_name: "Ramesh Sharma",
          previous_owner_name: "Mohan Sharma",
          seller_name: "Mohan Sharma",
          buyer_name: "Ramesh Sharma",
          survey_number: "124/2",
          khasra_number: "87/3",
          village: "Barkheda",
          district: "Sehore",
          area: "2.35",
          area_unit: "hectare",
          registration_number: "REG-2026-00124",
          registration_date: "14/07/2026",
          mutation_number: "MUT-45821",
          mutation_date: "20/08/2026",
        },
        overallConfidence: 0.96,
        model: "gemini-3.8-flash",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ext2Ref = doc(db, "document_extractions", "demo-ext-002");
      batch.set(ext2Ref, {
        documentId: "demo-doc-002",
        caseId: "demo-la-2026-00027",
        documentType: "KHASRA_RECORD",
        rawExtraction: {
          document_type: "KHASRA_RECORD",
          owner_name: "Ramesh Sharma",
          previous_owner_name: null,
          seller_name: null,
          buyer_name: null,
          survey_number: "124/2",
          khasra_number: "87/3",
          village: "Barkheda",
          district: "Sehore",
          area: "2.35",
          area_unit: "hectare",
          registration_number: null,
          registration_date: null,
          mutation_number: null,
          mutation_date: null,
        },
        overallConfidence: 0.94,
        model: "gemini-3.8-flash",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const ext3Ref = doc(db, "document_extractions", "demo-ext-003");
      batch.set(ext3Ref, {
        documentId: "demo-doc-003",
        caseId: "demo-la-2026-00027",
        documentType: "MUTATION_RECORD",
        rawExtraction: {
          document_type: "MUTATION_RECORD",
          owner_name: "Ramesh Sharma",
          previous_owner_name: "Mohan Sharma",
          seller_name: null,
          buyer_name: null,
          survey_number: "124/2",
          khasra_number: "87/3",
          village: "Barkheda",
          district: "Sehore",
          area: "2.35",
          area_unit: "hectare",
          registration_number: "REG-2026-00124",
          registration_date: null,
          mutation_number: "MUT-45821",
          mutation_date: "20/08/2026",
        },
        overallConfidence: 0.92,
        model: "gemini-3.8-flash",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 4. Legacy Land Record (Demo Case)
      const legacyRef = doc(db, "legacy_land_records", "demo-legacy-001");
      batch.set(legacyRef, {
        caseId: "demo-la-2026-00027",
        landRecordId: "LR-000124",
        ownerName: "Ramesh Sharma",
        surveyNumber: "124/2",
        khasraNumber: "87/3",
        village: "Barkheda",
        district: "Sehore",
        area: "2.35",
        areaUnit: "hectare",
        registrationNumber: "REG-2026-00124",
        mutationNumber: "MUT-45821",
        source: "Sehore District Land Revenue Registry (1998-2025)",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDemo: true,
      });

      // 5. Verification Run
      const runRef = doc(db, "verification_runs", "demo-run-001");
      batch.set(runRef, {
        caseId: "demo-la-2026-00027",
        status: "COMPLETED",
        startedAt: serverTimestamp(),
        completedAt: serverTimestamp(),
        initiatedBy: DEV_OFFICER.id,
        fieldValidationScore: 98,
        documentConsistencyScore: 96,
        extractedDataMatchScore: 95,
        legacyMatchScore: 95,
        integrityScore: 96,
        summary: "All 3 source documents correlate consistently with legacy registry LR-000124 across survey, khasra, owner, and land parcel area.",
        createdAt: serverTimestamp(),
      });

      // 6. Verification Field Results
      const field1Ref = doc(db, "verification_field_results", "demo-vfr-001");
      batch.set(field1Ref, {
        runId: "demo-run-001",
        caseId: "demo-la-2026-00027",
        fieldName: "owner_name",
        status: "MATCH",
        expectedValue: "Ramesh Sharma",
        actualValue: "Ramesh Sharma",
        explanation: "Owner identity verified across Sale Deed, Khasra, and Mutation Order.",
        severity: "LOW",
        createdAt: serverTimestamp(),
      });

      const field2Ref = doc(db, "verification_field_results", "demo-vfr-002");
      batch.set(field2Ref, {
        runId: "demo-run-001",
        caseId: "demo-la-2026-00027",
        fieldName: "area",
        status: "MATCH",
        expectedValue: "2.35 hectare",
        actualValue: "2.35 hectare",
        explanation: "Parcel area exactly aligns between Deed and Khasra register.",
        severity: "LOW",
        createdAt: serverTimestamp(),
      });

      const field3Ref = doc(db, "verification_field_results", "demo-vfr-003");
      batch.set(field3Ref, {
        runId: "demo-run-001",
        caseId: "demo-la-2026-00027",
        fieldName: "khasra_number",
        status: "MATCH",
        expectedValue: "87/3",
        actualValue: "87/3",
        explanation: "Khasra plot index consistent across all records.",
        severity: "LOW",
        createdAt: serverTimestamp(),
      });

      // 7. Ownership Chain
      const own1Ref = doc(db, "ownership_history", "demo-own-001");
      batch.set(own1Ref, {
        caseId: "demo-la-2026-00027",
        ownerName: "Ramesh Sharma",
        previousOwnerName: "Mohan Sharma",
        transactionType: "CONVEYANCE_DEED",
        transactionDate: "14/07/2026",
        registrationNumber: "REG-2026-00124",
        mutationNumber: "MUT-45821",
        sourceDocumentId: "demo-doc-001",
        createdAt: serverTimestamp(),
      });

      // 8. Processing Steps for Document 1
      const steps = [
        { step: "INGESTION", status: "COMPLETED", message: "Document received and verified against integrity hash." },
        { step: "DOCUMENT_UNDERSTANDING", status: "COMPLETED", message: "Text layer OCR extracted successfully (100% readability)." },
        { step: "CLASSIFICATION", status: "COMPLETED", message: "Classified as Registered Conveyance / Sale Deed with 98% confidence." },
        { step: "EXTRACTION", status: "COMPLETED", message: "Extracted 14 structured attributes conforming to revenue standards." },
        { step: "COMPLETED", status: "COMPLETED", message: "Document processing finalized and ready for verification run." },
      ];

      steps.forEach((s, i) => {
        const stepRef = doc(db, "processing_steps", `demo-step-001-${i}`);
        batch.set(stepRef, {
          caseId: "demo-la-2026-00027",
          documentId: "demo-doc-001",
          step: s.step,
          status: s.status,
          message: s.message,
          startedAt: serverTimestamp(),
          completedAt: serverTimestamp(),
          errorMessage: null,
        });
      });

      // 9. Initial Verified Land Record
      const vlrRef = doc(db, "verified_land_records", "demo-vlr-001");
      batch.set(vlrRef, {
        caseId: "demo-la-2026-00027",
        landRecordId: "LR-000124",
        propertyUid: "ULPIN-982143001",
        ownerName: "Ramesh Sharma",
        surveyNumber: "124/2",
        khasraNumber: "87/3",
        village: "Barkheda",
        district: "Sehore",
        area: "2.35",
        areaUnit: "hectare",
        registrationNumber: "REG-2026-00124",
        registrationDate: "14/07/2026",
        mutationNumber: "MUT-45821",
        mutationDate: "20/08/2026",
        verificationStatus: "Record Consistent",
        integrityScore: 96,
        verifiedBy: DEV_OFFICER.id,
        verifiedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        officerNote: "All 3 source documents correlate consistently with legacy registry LR-000124.",
        officerName: DEV_OFFICER.name,
        hasSecureVault: true,
      });

      // 10. Initial Audit Trail Logs
      const auditLogs = [
        {
          id: "demo-audit-001",
          action: "CASE_CREATED",
          description: "Case LA-2026-00027 established for highway expansion corridor intake.",
        },
        {
          id: "demo-audit-002",
          action: "DOCUMENT_UPLOADED",
          description: "Original Sale Deed uploaded and indexed for Ramesh Sharma (Barkheda).",
        },
        {
          id: "demo-audit-003",
          action: "RECORD_VERIFIED",
          description: "Cross-document verification run completed with 96% confidence score.",
        },
      ];

      auditLogs.forEach((a) => {
        const aRef = doc(db, "audit_logs", a.id);
        batch.set(aRef, {
          caseId: "demo-la-2026-00027",
          userId: DEV_OFFICER.id,
          action: a.action,
          description: a.description,
          timestamp: serverTimestamp(),
        });
      });

      await batch.commit();
      console.log("[Seed] Synthetic demo case LA-2026-00027 and verified records seeded into Firestore.");
    }

    // 11. Seed the 10 Pre-existing Reference Land Records unconditionally in Firestore
    const refBatch = writeBatch(db);
    for (const rec of DEFAULT_LEGACY_RECORDS) {
      const docRef = doc(db, "legacy_land_records", rec.landRecordId);
      refBatch.set(docRef, {
        caseId: "demo-la-2026-00027",
        propertyUid: rec.propertyUid,
        landRecordId: rec.landRecordId,
        ownerName: rec.ownerName,
        surveyNumber: rec.surveyNumber,
        khasraNumber: rec.khasraNumber,
        village: rec.village,
        district: rec.district,
        area: rec.area,
        areaUnit: rec.areaUnit,
        status: rec.status,
        source: `${rec.district} District Land Revenue Registry Archive`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isDemo: true,
      }, { merge: true });
    }
    await refBatch.commit();
    console.log("[Seed] 10 Reference Legacy Records synced to Firestore.");
  } catch (err) {
    console.warn("[Seed] Legacy records seeding skipped or notice:", err);
  }
}
