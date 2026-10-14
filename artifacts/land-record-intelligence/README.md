# Vision Vault · Land Record Intelligence System (LRIS)
*When the government purchases land from citizens, official officers must carefully verify every document before releasing compensation. Vision Vault transforms weeks of error-prone paperwork into instant, reliable digital records.*

---

## 🏛️ Executive Summary

**Vision Vault** is an enterprise-grade cadastral intelligence and land title reconciliation platform designed specifically for government revenue officers, land acquisition authorities, and registrar departments.

When the government purchases land from citizens for infrastructure and public works, official officers must carefully verify every document before releasing compensation. Right now, this means manually checking thousands of scanned paper deeds and handwritten records—causing huge delays and mistakes. Our AI platform solves this bottleneck using a multi-stage validation engine with human-in-the-loop verification, transforming weeks of error-prone paperwork into instant, reliable digital records.

---

## 📐 System Architecture

Vision Vault is architected as an event-driven, reactive web application with persistent cloud storage, multi-model AI vision cascades, client-side Web Audio speech synthesis, and real-time Firestore synchronization.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER (REACT 18)                              │
│  ┌────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│  │ 3D Cadastral Mesh (GL) │  │  Multi-Deed Document OCR  │  │ Stage-3 Verification  │  │
│  │   Interactive Canvas   │  │   Camera / PDF / Image    │  │   Visual Comparator   │  │
│  └───────────┬────────────┘  └─────────────┬─────────────┘  └───────────┬───────────┘  │
└──────────────┼─────────────────────────────┼────────────────────────────┼──────────────┘
               │                             │                            │
               ▼                             ▼                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                APPLICATION SERVICES ENGINE                             │
│  ┌─────────────────────────────────┐       ┌────────────────────────────────────────┐  │
│  │     Gemini Vision AI Engine     │       │    Cadastral Verification Engine       │  │
│  │  • Strict JSON Schema Validation│       │  • Fuzzy Levenshtein Matchers          │  │
│  │  • Semantic Synonyms Normalizer │       │  • Unit Conversion (Acre/Hectare/Bigha)│  │
│  │  • Multi-Tier Model Fallback    │       │  • 17 Revenue Parameter Comparator     │  │
│  └────────────────┬────────────────┘       └───────────────────┬────────────────────┘  │
└───────────────────┼────────────────────────────────────────────┼───────────────────────┘
                    │                                            │
                    ▼                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD PERSISTENCE (FIRESTORE)                             │
│  ┌────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────┐  │
│  │  `cases` & `documents` │  │  `legacy_land_records`    │  │ `verified_land_records│  │
│  │  Active Ingestion Tree │  │  Government Ground Truth  │  │ & `audit_logs`        │  │
│  └────────────────────────┘  └───────────────────────────┘  └───────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 End-to-End User Workflow

1. **Officer Authentication & Session Validation**:
   - The revenue officer logs into the secure portal via Clerk or designated Revenue Officer profiles.
   - Session keys are bound to case actions and immutable audit entries.

2. **Case Creation**:
   - Officer creates a **Land Acquisition Case** specifying Project Name (e.g., *NH-48 Highway Expansion Corridor*), District, Tehsil, and Target Village.

3. **Multi-Format Document Ingestion**:
   - Ingests physical scans, camera snaps, multi-page PDFs, or high-resolution images (*Sale Deeds, Gift Deeds, Mutations, RoR / 7/12 extracts, Jamabandis, Mortgage Clearances*).
   - Instant client-side preprocessing optimizes contrast and text clarity.

4. **Multi-Tier Zero-Hallucination OCR & Semantic Extraction**:
   - The document is dispatched to Google Gemini Vision with strict structured JSON schema enforcement.
   - Extracts 17 standardized cadastral fields while bridging local dialects and terminology synonyms.

5. **Stage 1 & Stage 2 Verification**:
   - **Stage 1 (Internal Consistency)**: Cross-checks document math (e.g., total consideration vs. stamp duty percentage, seller/buyer name completeness).
   - **Stage 2 (Cross-Document Correlation)**: Correlates multiple deeds within the same case to detect chain-of-title anomalies or parcel split discrepancies.

6. **Stage 3: Ground-Truth Database Verification**:
   - The extracted deed is matched in real time against the pre-seeded government baseline registry (`legacy_land_records`).
   - Weighted multi-field comparison highlights **Exact Matches (🟢)**, **Possible Variations (🟡)**, and **Critical Conflicts (🔴)**.

7. **Officer Adjudication & Keynote Disposition**:
   - The officer reviews side-by-side comparisons, inspects conflicts, and must enter a mandatory **Officer Keynote / Justification** before approving or flagging.
   - Approved records are committed to `verified_land_records`, while an unalterable log is appended to `audit_logs`.

---

## 🔍 The Three Verification Stages in Detail

### Stage 1: Optical & Schema Integrity
* Validates image quality, readability score, document category classification, and JSON schema conformity.
* Ensures non-hallucinated extractions; any field absent in the source document is flagged with null confidence rather than fabricated data.

### Stage 2: Case-Level Cross-Deed Reconciliation
* Validates whether previous transactions on the same plot number match the current seller's acquisition history.
* Checks boundary demarcation statements (*North, South, East, West boundaries*) across parent and child deeds.

### Stage 3: Existing Database Ground Truth Verification
Vision Vault pre-seeds and maintains an authoritative government land registry baseline (`legacy_land_records`). When an extraction completes, the Stage 3 Engine executes:

1. **Multi-Parametric Candidate Retrieval**: Queries existing database records matching Village/Tehsil or Khasra Number.
2. **Weighted Field Correlation**:
   - **Khasra / Plot Number Match**: 30% weight
   - **Survey Number Match**: 20% weight
   - **Owner / Seller Name Similarity**: 25% weight (utilizing token-based fuzzy matching)
   - **Area & Measurement Equivalence**: 15% weight (with cross-unit normalization)
   - **Land Classification & Revenue Zone**: 10% weight
3. **Discrepancy Highlighting**:
   - 🟢 **Exact Match**: Field matches official RoR identically.
   - 🟡 **Partial Match / Name Variant**: e.g., *"Rajesh K. Sharma"* vs *"Rajesh Kumar Sharma"*.
   - 🔴 **Conflict Detected**: Area in deed exceeds registered Jamabandi allotment, or encumbrance exists.
4. **Officer Review & Final Disposition**:
   - Side-by-side visual matrix showing `Extracted Field` vs `Official Registry Record`.
   - Officer designates Status: **APPROVED**, **REQUIRES INVESTIGATION**, or **REJECTED**.
   - Requires officer remarks and appends to the unalterable audit ledger.

---

## 📋 The 17 Canonical Revenue Parameters

Vision Vault maps vernacular and regional terms to 17 canonical revenue parameters:

| # | Parameter Name | Canonical Key | Vernacular Synonyms Handled |
|---|---|---|---|
| 1 | Case / Deed Reference | `deedNumber` | Dastavez No., Document No., Reg. No., Wasika |
| 2 | Registration Date | `registrationDate` | Tarikh Dastavez, Date of Execution, Registry Date |
| 3 | State / Province | `state` | Rajya, State Jurisdiction |
| 4 | District | `district` | Zila, District Collectorate |
| 5 | Tehsil / Sub-District | `tehsil` | Taluka, Mandal, Anchal, Circle |
| 6 | Village / Mauza | `village` | Mauza, Gram, Revenue Village, Deh |
| 7 | Khasra / Plot Number | `khasraNumber` | Khasra No., Dag No., Survey No., Kitta |
| 8 | Khatiyan / Khata Number | `khataNumber` | Khatauni, Khewat, Holding No., Jamabandi No. |
| 9 | Parcel Area | `area` | Rakba, Total Area, Extent, Measurement |
| 10| Unit of Measurement | `unit` | Bigha-Biswa, Acre, Hectare, Guntha, Cent, Sq. Ft. |
| 11| Land Classification | `landType` | Agricultural, Chahi, Nahri, Gair Mumkin, Commercial |
| 12| Primary Seller / Executant | `sellerName` | Dehendar, Seller, Vendor, First Party |
| 13| Primary Buyer / Claimant | `buyerName` | Girehandar, Buyer, Vendee, Second Party |
| 14| Total Consideration Value | `transactionAmount` | Kimat, Consideration Amount, Sale Value |
| 15| Stamp Duty & Registration Fee | `stampDuty` | Stamp Duty Paid, Court Fees, Reg Fee |
| 16| Boundary Demarcations | `boundaries` | Chaddewari, North/South/East/West Demarcation |
| 17| Encumbrance / Liability Status | `encumbranceStatus` | Bar, Mortgage, Loan Lien, Court Injunction, Nil |

---

## 🛡️ Reliability & Model Cascade Architecture

To guarantee sub-4s response times and absolute uptime without UI freezing:
* **Primary AI Engine**: `gemini-2.5-flash` / `gemini-3.1-flash-lite` configured with strict temperature (0.0) and response mime-type `application/json`.
* **Dynamic Timeout Watchdog**: 8-second watchdog timer prevents pending network freezes.
* **Cascading Fallback**: Automatic fallback cascade executes secondary vision passes and deterministic pattern matching if an upstream timeout occurs.
* **Semantic Normalization Engine**: Translates non-standard labels into uniform schemas regardless of document formatting differences.

---

## 🛠️ Technology Stack

* **Frontend**: React 18, TypeScript, Vite 7, Tailwind CSS v4, Wouter (lightweight routing), TanStack React Query.
* **UI & Visuals**: Lucide React Icons, Interactive WebGL / HTML5 Canvas 3D Cadastral Land Mesh, Animated Cartoon Officer Feedback.
* **Audio Intelligence**: Web Audio API with customizable pitch, speech synthesis rate, voice presets, and MP3 sound alerts.
* **Backend & Storage**: Firebase Firestore (NoSQL, Realtime Listeners), Firebase Cloud Storage.
* **Authentication**: Clerk Multi-Session Auth & Officer Development Bypass Switch.
* **AI & Document Intelligence**: Google GenAI SDK (`@google/genai`), Multi-Modal Vision Processing.

---

## 🚀 Getting Started

### Prerequisites
* Node.js v18+ & npm
* Firebase Project credentials (configured via `src/firebase-applet-config.json` or environment variables)

### Installation
```bash
# Clone the repository
git clone <repo-url>
cd land-record-intelligence

# Install dependencies
npm install

# Start development server on port 3000
npm run dev
```

### Build for Production
```bash
npm run build
```

---

## 🔒 Security & Compliance
* **Tamper-Evident Audit Logging**: Every scan, comparison, field edit, and approval is immutably timestamped with officer UUID and client IP hash.
* **Zero-Retention OCR Buffer**: Raw image buffers are processed in memory and sealed; confidential deed values are encrypted at rest in Firestore.
* **Role-Based Access Control (RBAC)**: Strict permission boundaries distinguishing *Scanning Officers*, *Verification Officers*, and *District Super-Admins*.

---
*Vision Vault — Precision Land Record Intelligence for Modern Governance.*
