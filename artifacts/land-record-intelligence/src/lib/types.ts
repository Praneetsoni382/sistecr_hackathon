export type CaseStatus =
  | "DRAFT"
  | "PROCESSING"
  | "READY_FOR_VERIFICATION"
  | "VERIFIED"
  | "MANUAL_REVIEW"
  | "INCONSISTENT"
  | "Record Consistent"
  | "Review Required"
  | "Potential Conflict"
  | "Human Verification Required";

export type DocumentType =
  | "SALE_DEED"
  | "KHASRA_RECORD"
  | "MUTATION_RECORD"
  | "OWNERSHIP_CERTIFICATE"
  | "REGISTRATION_RECORD"
  | "IRRELEVANT_NON_LAND_RECORD"
  | "UNKNOWN";

export type DocumentStatus = "UPLOADED" | "PROCESSING" | "COMPLETED" | "FAILED";

export type VerificationStatus =
  | "Record Consistent"
  | "Review Required"
  | "Potential Conflict"
  | "Human Verification Required";

export type ProcessingStepType =
  | "INGESTION"
  | "DOCUMENT_UNDERSTANDING"
  | "CLASSIFICATION"
  | "EXTRACTION"
  | "COMPLETED";

export type StepStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

export type FieldMatchStatus =
  | "MATCH"
  | "MISMATCH"
  | "SINGLE_SOURCE"
  | "MISSING"
  | "NIL"
  | "REVIEW_REQUIRED";

export interface Case {
  id: string;
  caseNumber: string; // e.g. "LA-2026-00027"
  projectName: string;
  district: string;
  village: string;
  description: string;
  acquisitionReference?: string;
  status: CaseStatus;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  isDemo?: boolean;
  documentCount?: number;
}

export interface CaseDocument {
  id: string;
  caseId: string;
  documentType: DocumentType;
  fileName: string;
  storagePath: string;
  fileUrl?: string;
  fileSize: number;
  mimeType: string;
  serialNumber: number;
  status: DocumentStatus;
  uploadedBy: string;
  uploadedAt: any;
  processedAt?: any;
  errorMessage?: string | null;
  isDemo?: boolean;
}

export type FieldExtractionStatus = "FOUND" | "NOT_FOUND" | "UNCERTAIN" | "NOT_APPLICABLE" | "ILLEGIBLE";

export interface ExtractedFieldDetail {
  value: string | null;
  confidence: number;
  status: FieldExtractionStatus;
  evidence_text: string | null;
  evidence_location: string | null;
}

export interface GeminiExtractionSchema {
  is_land_record?: boolean;
  document_relevance?: "LAND_RELATED" | "NOT_LAND_RELATED" | "UNKNOWN" | string | null;
  document_type: DocumentType | null;
  irrelevant_reason?: string | null;
  property_uid?: string | null;
  owner_name: string | null;
  previous_owner_name: string | null;
  seller_name: string | null;
  buyer_name: string | null;
  survey_number: string | null;
  khasra_number: string | null;
  khata_number?: string | null;
  village: string | null;
  district: string | null;
  state?: string | null;
  area: string | null;
  area_unit: string | null;
  registration_number: string | null;
  registration_date: string | null;
  mutation_number: string | null;
  mutation_date: string | null;
  raw_ocr_summary?: string | null;
  confidence_score?: number | null;
  fields?: Record<string, ExtractedFieldDetail>;
}

export interface DocumentExtraction {
  id: string;
  documentId: string;
  caseId: string;
  documentType: DocumentType;
  rawExtraction: GeminiExtractionSchema;
  overallConfidence: number | null;
  model: string;
  createdAt: any;
  updatedAt: any;
}

export interface ExtractedField {
  id: string;
  documentId: string;
  caseId: string;
  fieldName: string;
  extractedValue: string | null;
  normalizedValue: string | null;
  confidence: number | null;
  status?: FieldExtractionStatus;
  evidenceText?: string | null;
  evidenceLocation?: string | null;
  sourceText: string | null;
  createdAt: any;
}

export interface LegacyLandRecord {
  id: string;
  caseId: string;
  propertyUid?: string;
  ownerName: string;
  surveyNumber: string;
  khasraNumber: string;
  village: string;
  district: string;
  area: string;
  areaUnit: string;
  registrationNumber?: string;
  mutationNumber?: string;
  source: string;
  createdAt: any;
  updatedAt: any;
  isDemo?: boolean;
}

export interface DocumentFieldValue {
  documentId: string;
  documentName: string;
  documentType: string;
  value: string | null;
  isNil: boolean;
}

export interface VerificationFieldResult {
  id: string;
  runId: string;
  caseId: string;
  fieldName: string;
  fieldLabel?: string;
  status: FieldMatchStatus;
  expectedValue: string | null;
  actualValue: string | null;
  legacyValue?: string | null;
  documentValues?: DocumentFieldValue[];
  conflictingValues?: string[];
  sourceDocuments?: string[];
  explanation: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "INFO";
  createdAt: any;
}

export interface VerificationRun {
  id: string;
  caseId: string;
  status: "COMPLETED" | "IN_PROGRESS" | "FAILED";
  startedAt: any;
  completedAt?: any;
  initiatedBy: string;
  fieldValidationScore: number;
  documentConsistencyScore: number;
  extractedDataMatchScore: number;
  legacyMatchScore: number;
  integrityScore: number;
  summary: string;
  createdAt: any;
}

export interface OwnershipHistory {
  id: string;
  caseId: string;
  ownerName: string;
  previousOwnerName?: string;
  transactionType: string;
  transactionDate?: string;
  registrationNumber?: string;
  mutationNumber?: string;
  sourceDocumentId?: string;
  createdAt: any;
}

export interface VerifiedLandRecord {
  id: string;
  caseId: string;
  landRecordId: string;
  propertyUid?: string;
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
  verifiedBy: string;
  verifiedAt: any;
  createdAt: any;
  updatedAt: any;
  officerNote?: string;
  officerName?: string;
  hasSecureVault?: boolean;
  vaultNotes?: string;
  vaultCreatedAt?: any;
  vaultId?: string;
  isDemo?: boolean;
}

export interface SecureVaultRecord {
  id: string;
  caseId: string;
  recordId: string;
  landRecordId: string;
  caseNumber?: string;
  projectName?: string;
  ownerName: string;
  surveyNumber: string;
  khasraNumber: string;
  village: string;
  district: string;
  area: string;
  areaUnit: string;
  verificationStatus: VerificationStatus;
  integrityScore: number;
  officerNote?: string;
  officerName?: string;
  vaultNotes?: string;
  hasSecureVault: boolean;
  createdAt: any;
  updatedAt: any;
}

export type AuditAction =
  | "CASE_CREATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_PROCESSING_STARTED"
  | "DOCUMENT_CLASSIFIED"
  | "FIELDS_EXTRACTED"
  | "FIELD_VALIDATION_COMPLETED"
  | "CROSS_DOCUMENT_CHECK_COMPLETED"
  | "LEGACY_COMPARISON_COMPLETED"
  | "CONFLICT_DETECTED"
  | "DOCUMENT_VIEWED"
  | "FIELD_EDITED"
  | "VERIFICATION_STARTED"
  | "RECORD_VERIFIED"
  | "RECORD_MARKED_FOR_REVIEW"
  | "RECORD_MARKED_INCONSISTENT"
  | "DOCUMENT_DELETED"
  | "AADHAAR_VERIFICATION_STARTED"
  | "AADHAAR_XML_EXTRACTED"
  | "AADHAAR_SIGNATURE_VERIFIED"
  | "AADHAAR_SIGNATURE_FAILED"
  | "AADHAAR_VERIFICATION_COMPLETED"
  | "AADHAAR_VERIFICATION_FAILED"
  | "AADHAAR_MATCH_ACCEPTED"
  | "AADHAAR_MATCH_FLAGGED";

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

export type AadhaarOfficerDecision = "ACCEPTED" | "REVIEW_REQUIRED" | "PROCEEDED_WITHOUT_MATCH" | "PENDING";

export interface AadhaarVerificationResult {
  id: string;
  caseId: string;
  caseNumber?: string;
  xmlStructureValid: boolean;
  signatureVerificationStatus: SignatureVerificationStatus;
  signatureAlgorithm?: string | null;
  signerCertificateSubject?: string | null;
  signerCertificateIssuer?: string | null;
  identity: AadhaarIdentity;
  verifiedAt: any;
  verifiedBy: string;
  verificationNotes?: string;
  officerDecision?: AadhaarOfficerDecision;
}

export type IdentityLandMatchStatus = "MATCH" | "PARTIAL_MATCH" | "MISMATCH" | "NOT_AVAILABLE" | "REVIEW_REQUIRED";

export interface IdentityLandComparison {
  aadhaarName: string | null;
  landRecordOwner: string | null;
  status: IdentityLandMatchStatus;
  confidence: number;
  explanation: string;
}

export interface AuditLog {
  id: string;
  caseId?: string | null;
  documentId?: string | null;
  userId: string;
  action: AuditAction;
  description: string;
  metadata?: Record<string, any>;
  timestamp: any;
}

export interface ProcessingStep {
  id: string;
  caseId: string;
  documentId: string;
  step: ProcessingStepType;
  status: StepStatus;
  message: string;
  startedAt: any;
  completedAt?: any;
  errorMessage?: string | null;
  metadata?: Record<string, any>;
}

export interface DashboardSummary {
  totalCases: number;
  documentsUploaded: number;
  documentsProcessed: number;
  recordsVerified: number;
  recordsRequiringReview: number;
  conflictsDetected: number;
}
