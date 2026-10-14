import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";

export type AppLanguage = "en" | "hi";

interface LanguageContextType {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
  toggleLanguage: () => void;
  isHindi: boolean;
  t: (text: string | null | undefined) => string;
}

// 1. Exact phrase and sentence translations & transcriptions
const TRANSLATION_DICTIONARY: Record<string, string> = {
  // Navigation & Shell
  "Workspace": "कार्यक्षेत्र",
  "System": "प्रणाली",
  "Dashboard": "डैशबोर्ड (ओवरव्यू)",
  "Overview": "ओवरव्यू",
  "overview": "ओवरव्यू",
  "Cases": "केसेस",
  "cases": "केसेस",
  "Case": "केस",
  "case": "केस",
  "All cases": "सभी केसेस",
  "All Cases": "सभी केसेस",
  "New case": "नया केस",
  "New Case": "नया केस",
  "Verified Records": "सत्यापित रिकॉर्ड्स",
  "Existing Records": "मौजूदा रिकॉर्ड्स",
  "Existing Land Records (Baseline)": "मौजूदा रिकॉर्ड्स (बेसलाइन)",
  "Audit trail": "ऑडिट ट्रेल",
  "Audit Trail": "ऑडिट ट्रेल",
  "Audit Vault": "ऑडिट वॉल्ट",
  "Settings": "सेटिंग्स",
  "Firebase Usage Monitor": "उपयोग मॉनिटर",
  "Vision Vault": "विज़न वॉल्ट",
  "Land Record Intelligence": "भू-अभिलेख आसूचना प्रणाली",
  "Return to Workspace": "कार्यक्षेत्र पर वापस जाएं",
  "Return": "वापस जाएं",
  "System Ready": "सिस्टम रेडी",
  "Scan Voice": "स्कैन वॉइस",
  "Quota Exceeded": "कोटा समाप्त",
  "Quota": "कोटा",
  "Revenue Officer": "राजस्व अधिकारी",
  "OFFICER": "ऑफिसर",
  "Officer": "ऑफिसर",
  "Development Officer": "विकास अधिकारी",
  "Authorized Revenue Officer": "अधिकृत राजस्व अधिकारी",
  "Authorized Revenue Officer Access Only": "केवल अधिकृत राजस्व अधिकारी पहुंच",
  "Resource Usage Monitor": "रिसोर्स यूसेज मॉनिटर",
  "RESOURCE USAGE MONITOR": "रिसोर्स यूसेज मॉनिटर",
  "System Healthy": "सिस्टम हेल्दी",
  "Reset Session Count": "सेशन रीसेट करें",
  "Daily Reads (Firestore)": "दैनिक रीड्स (फ़ायरस्टोर)",
  "Daily Writes": "दैनिक राइट्स",
  "of free quota": "निःशुल्क कोटा का",
  "Reset: Midnight": "रीसेट: मध्यरात्रि",
  "Approaching Quota Limit": "कोटा सीमा के निकट",
  "Critical Quota Alert": "गंभीर कोटा चेतावनी",

  // Camera & Live Scan feature
  "Live Document Scan": "लाइव दस्तावेज़ स्कैन",
  "Live Document Scanner": "लाइव दस्तावेज़ स्कैनर",
  "HD Camera OCR": "एचडी कैमरा ओसीआर",
  "Allow Camera Access": "कैमरा पहुंच की अनुमति दें",
  "Allow Camera": "अनुमति दें (Allow Camera)",
  "Disallow": "अस्वीकार करें (Disallow)",
  "Disallow / Cancel": "अस्वीकार करें / रद्द करें",
  "Allow & Open Camera": "अनुमति दें और कैमरा खोलें",
  "Use Sample Land Record Photo": "नमूना भू-अभिलेख फोटो का उपयोग करें",
  "Camera permission disallowed by user.": "उपयोगकर्ता द्वारा कैमरा अनुमति अस्वीकार की गई।",
  "To scan physical land deed records live, please allow camera permission. Clicking 'Allow & Open Camera' will trigger your device camera.": "भौतिक भूमि विलेख रिकॉर्ड को लाइव स्कैन करने के लिए, कृपया कैमरा अनुमति दें। 'अनुमति दें और कैमरा खोलें' पर क्लिक करने से आपका डिवाइस कैमरा खुल जाएगा।",
  "Or Select Photo": "या फोटो चुनें",
  "Select Document Photo File": "दस्तावेज़ फोटो फाइल चुनें",
  "Align Sale Deed, Khasra, or Revenue Registry within viewfinder frame.": "व्यूफ़ाइंडर फ़्रेम में बिक्री विलेख, खसरा या राजस्व रजिस्ट्री संरेखित करें।",
  "Page Preview": "पेज पूर्वावलोकन",
  "Return to Live Camera": "लाइव कैमरा पर लौटें",
  "Hold steady • Align deed edges inside box": "स्थिर रखें • बॉक्स के अंदर दस्तावेज़ के किनारों को मिलाएँ",
  "Camera Access Needed": "कैमरा पहुंच की आवश्यकता है",
  "Please allow camera permission in your browser URL settings to scan physical land records live.": "भौतिक भूमि रिकॉर्ड को लाइव स्कैन करने के लिए अपने ब्राउज़र सेटिंग्स में कैमरा अनुमति दें।",
  "Retry Camera Permission": "कैमरा अनुमति पुनः प्रयास करें",
  "Toggle Flashlight / Torch": "फ़्लैशलाइट चालू/बंद करें",
  "Flash On": "फ़्लैश ऑन",
  "Flash Off": "फ़्लैश ऑफ़",
  "Switch Front / Rear Camera": "सामने / पीछे का कैमरा बदलें",
  "Rear Cam": "बैक कैमरा",
  "Front Cam": "फ्रंट कैमरा",
  "Capture Land Record Page": "भूमि रिकॉर्ड पेज कैप्चर करें",
  "Captured Pages": "कैप्चर किए गए पेजेस",
  "No pages captured yet.": "अभी तक कोई पेज कैप्चर नहीं हुआ है।",
  "Point your camera at the physical land deed and click the green capture button.": "अपने कैमरे को भौतिक भूमि विलेख पर रखें और हरे कैप्चर बटन पर क्लिक करें।",
  "Document Title / Label": "दस्तावेज़ शीर्षक / लेबल",
  "Revenue Deed Class": "राजस्व विलेख प्रकार",
  "Save & Process": "सहेजें और प्रोसेस करें",
  "Uploading scanned pages…": "स्कैन किए गए पेज अपलोड हो रहे हैं…",
  "road_construction": "रोड_कंस्ट्रक्शन",
  "road construction": "रोड कंस्ट्रक्शन",
  "Road Construction": "रोड कंस्ट्रक्शन",
  "Road construction": "रोड कंस्ट्रक्शन",
  "bhopal_road_construction": "भोपाल_रोड_कंस्ट्रक्शन",
  "Bhopal Road Construction": "भोपाल रोड कंस्ट्रक्शन",
  "first case": "फर्स्ट केस",
  "first_case": "फर्स्ट_केस",
  "second case": "सेकंड केस",
  "second_case": "सेकंड_केस",
  "third case": "थर्ड केस",
  "third_case": "थर्ड_केस",
  "fourth case": "फोर्थ केस",
  "fourth_case": "फोर्थ_केस",
  "nhai 27": "एनएचएआई 27",
  "nhai": "एनएचएआई",
  "NHAI": "एनएचएआई",
  "jamnagar": "जामनगर",
  "Jamnagar": "जामनगर",
  "rampur": "रामपुर",
  "Rampur": "रामपुर",
  "bamora": "बमोरा",
  "Bamora": "बमोरा",
  "Bairagarh": "बैरागढ़",
  "bairagarh": "बैरागढ़",
  "Praneet soni": "प्रणीत सोनी",
  "Praneet Soni": "प्रणीत सोनी",
  "Praneet": "प्रणीत",
  "Soni": "सोनी",

  // Case Workspace General & Metrics
  "Case workspace": "केस वर्कस्पेस",
  "Case Workspace": "केस वर्कस्पेस",
  "Case ID": "केस आईडी",
  "Source documents": "सोर्स डॉक्यूमेंट्स",
  "Source Documents": "सोर्स डॉक्यूमेंट्स",
  "Integrity Score": "इंटीग्रिटी स्कोर",
  "Created": "सृजित (क्रिएटेड)",
  "Intake context": "इंटेक संदर्भ (कॉन्टेक्स्ट)",
  "Delete Case": "केस हटाएं (डिलीट)",
  "Delete Document": "दस्तावेज़ हटाएं",
  "Pending": "पेंडिंग",
  "Consistent": "कंसिस्टेंट",
  "Variance": "वेरिएंस (विसंगति)",
  "No acquisition reference recorded": "कोई अधिग्रहण संदर्भ दर्ज नहीं",

  // Workflow Stages & Tabs
  "Source Documents (": "सोर्स डॉक्यूमेंट्स (",
  "OCR Extraction & Steps": "ओसीआर एक्सट्रैक्शन व चरण (स्टेप्स)",
  "Cross-Verification & Title": "क्रॉस-वेरिफिकेशन व स्वत्व (टाइटल)",
  "Verify in Database": "डेटाबेस में सत्यापित करें (स्टेज 3)",
  "Audit Trail (": "ऑडिट ट्रेल (",
  "Registered Documents": "पंजीकृत दस्तावेज़ (रजिस्टर्ड डॉक्यूमेंट्स)",
  "Uploaded deeds, scans, and cadastral records for this case":
    "इस केस के लिए अपलोड किए गए विलेख, स्कैन और भू-अभिलेख",
  "Process All with Gemini": "जेमिनी एआई से सभी प्रोसेस करें",
  "Processing Queue...": "प्रोसेसिंग कतार...",
  "Filename": "फाइलनेम",
  "Document Type": "दस्तावेज़ प्रकार",
  "Gemini Action": "जेमिनी एक्शन",
  "Actions": "कार्यवाही (एक्शंस)",
  "Action": "एक्शन",
  "Irrelevant Non-Land": "अप्रासंगिक (गैर-भूमि दस्तावेज़)",
  "Extracted": "एक्सट्रैक्टेड (विश्लेषित)",
  "Extracting": "एक्सट्रैक्ट किया जा रहा है...",
  "Quota Hit": "कोटा सीमा",
  "Failed": "विफल (फेल्ड)",
  "Uploaded": "अपलोडेड",
  "View Attributes": "एट्रिब्यूट्स देखें",
  "Re-extract": "पुनः एक्सट्रैक्ट करें",
  "Extract Attributes": "एट्रिब्यूट्स निकालें",
  "Document Queue:": "डॉक्यूमेंट कतार:",

  // Single Upload Zone
  "Upload Land Record Source Documents": "भू-अभिलेख मूल दस्तावेज़ अपलोड करें",
  "Drag & drop your Sale Deed, Khasra, Mutation, or Registry (PDF, JPG, PNG) — multiple files supported.":
    "अपनी विक्रय विलेख (सेल डीड), खसरा, नामांतरण (म्यूटेशन) या रजिस्ट्री ड्रैग और ड्रॉप करें (पीडीएफ, जेपीजी, पीएनजी समर्थित)।",
  "Type:": "प्रकार:",
  "Sale Deed / Registry Deed": "विक्रय विलेख / रजिस्ट्री डीड",
  "Khasra / Khatauni Record": "खसरा / खतौनी रिकॉर्ड",
  "Mutation / Namantaran Order": "नामांतरण आदेश (म्यूटेशन)",
  "Ownership Certificate": "स्वामित्व प्रमाणपत्र",
  "Sub-Registrar Record": "उप-पंजीयक (सब-रजिस्ट्रार) अभिलेख",
  "Auto-detect from file": "फ़ाइल से स्वतः पहचानें",
  "Select Document(s) to Upload": "अपलोड के लिए दस्तावेज़ चुनें",
  "Uploading Documents…": "दस्तावेज़ अपलोड हो रहे हैं…",
  "Saving documents…": "दस्तावेज़ सुरक्षित हो रहे हैं…",

  // Manual Review & Extracted Attributes Section
  "Extracted Fields for:": "एक्सट्रैक्टेड फ़ील्ड्स:",
  "Displaying extracted parameters directly.": "दस्तावेज़ से प्राप्त पैरामीटर्स प्रदर्शित हो रहे हैं।",
  "Manual Review (Scanned Document & Extraction Table)": "मैनुअल रिव्यू (स्कैन दस्तावेज़ व एक्सट्रैक्शन तालिका)",
  "Hide Manual Review": "मैनुअल रिव्यू छुपाएं",
  "Back to Source Documents": "सोर्स डॉक्यूमेंट्स पर वापस जाएं",
  "Manual Review Workspace: Scanned Document & Extraction Table":
    "मैनुअल रिव्यू वर्कस्पेस: स्कैन दस्तावेज़ एवं एक्सट्रैक्शन तालिका",
  "Dual Manual Inspection": "द्विपक्षीय भौतिक सत्यापन",
  "Original Scanned Document": "मूल स्कैन दस्तावेज़",
  "Extraction Table Parameters": "एक्सट्रैक्शन तालिका पैरामीटर्स",
  "Manual Review Ready": "मैनुअल रिव्यू हेतु तैयार",
  "Verified Extraction Payload": "सत्यापित एक्सट्रैक्शन पेलोड",
  "Extracted Structured Land Attributes": "संरचित भू-अभिलेख एट्रिब्यूट्स (एक्सट्रैक्टेड)",
  "Extraction Complete": "एक्सट्रैक्शन पूर्ण",
  "Extraction Halted (Quota Exceeded)": "एक्सट्रैक्शन रुका (कोटा समाप्त)",
  "Extraction Unavailable": "एक्सट्रैक्शन उपलब्ध नहीं",
  "Non-Land File (Nil Fields)": "गैर-भू दस्तावेज़ (शून्य फ़ील्ड्स)",
  "Model Engine:": "मॉडल इंजन:",
  "Classification:": "वर्गीकरण:",
  "Optical Confidence:": "ऑप्टिकल कॉन्फिडेंस:",
  "FOUND": "प्राप्त (फाउंड)",
  "NOT_FOUND": "अनुपस्थित",
  "NOT PRESENT": "उपलब्ध नहीं",
  "NOT_APPLICABLE": "लागू नहीं",
  "N/A": "लागू नहीं",
  "Evidence:": "साक्ष्य (एविडेंस):",
  "Vision Optical OCR Stream": "विज़न ऑप्टिकल ओसीआर स्ट्रीम",
  "nil": "निल (शून्य)",
  "nil (Not found in document)": "निल (दस्तावेज़ में अनुपस्थित)",

  // Reconciliation Engine (Stage 2)
  "Reconciliation Engine": "पुनर्मिलान इंजन (रिकॉन्सिलिएशन इंजन)",
  "Multi-Document Cross-Verification & Reconciliation":
    "बहु-दस्तावेज़ क्रॉस-वेरिफिकेशन एवं पुनर्मिलान (रिकॉन्सिलिएशन)",
  "Rigorous character-by-character cross-verification across all uploaded deeds, revenue records, and official government baseline registers. Zero-hallucination comparison.":
    "सभी अपलोड किए गए विलेखों, राजस्व अभिलेखों और आधिकारिक सरकारी बेसलाइन रजिस्टरों के बीच अक्षरशः निष्पक्ष तुलना। शून्य-भ्रांति सत्यापन।",
  "Run Reconciliation": "रिकॉन्सिलिएशन चलाएं",
  "Analyzing Documents…": "दस्तावेज़ों का विश्लेषण हो रहा है…",
  "High Concordance": "उच्च समानता (कंसिस्टेंट)",
  "Discrepancy Flagged": "विसंगति चिह्नित (फ्लैग्ड)",
  "Verified Matches": "सत्यापित मिलान (वेरिफाइड मैचेस)",
  "Identical cross-records": "दस्तावेजों में एकसमान मूल्य",
  "Conflicts / Mismatches": "कॉन्फ्लिक्ट्स / मिसमैचेस",
  "Conflicting values": "परस्पर विरोधी मान (कॉन्फ्लिक्ट)",
  "No conflicts detected": "कोई विरोध नहीं पाया गया",
  "Single Source": "एकल स्रोत (सिंगल सोर्स)",
  "Uncorroborated": "अन्य स्रोतों से अपुष्ट",
  "Nil / Unstated": "निल / अनिर्दिष्ट",
  "Absent across files": "सभी फाइलों में अनुपस्थित",
  "Cross-Document Attribute Matrix": "क्रॉस-डॉक्यूमेंट एट्रिब्यूट मैट्रिक्स",
  "parameters evaluated": "पैरामीटर्स का मूल्यांकन",
  "VERIFIED MATCH": "सत्यापित मिलान (वेरिफाइड मैच)",
  "CONFLICT / MISMATCH": "कॉन्फ्लिक्ट / मिसमैच",
  "SINGLE SOURCE": "सिंगल सोर्स (एकल स्रोत)",
  "NIL / UNSET": "निल / रिक्त",
  "Uploaded Source Documents": "अपलोड किए गए सोर्स डॉक्यूमेंट्स",
  "Official Government Registry Baseline": "आधिकारिक सरकारी रजिस्ट्री बेसलाइन",
  "Registry Record": "रजिस्ट्री रिकॉर्ड",
  "nil (No registry baseline)": "निल (कोई बेसलाइन नहीं)",
  "Conflict Note:": "कॉन्फ्लिक्ट विवरण:",
  "Determination:": "निर्णय / अवलोकन:",

  // Stage 3 Callout in Case Workspace
  "Final Verification Stage": "अंतिम सत्यापन चरण (स्टेज 3)",
  "Stage 3 Database Matching & Officer Keynotes":
    "स्टेज 3: डेटाबेस मिलान एवं अधिकारी कीनोट्स",
  "Officer determination keynotes (minimum 12 words required) and final record disposition are recorded on the Stage 3 Database Matching page for official record maintenance.":
    "अधिकारी के निर्णय कीनोट्स (न्यूनतम 12 शब्द अनिवार्य) और अंतिम रिकॉर्ड स्थिति आधिकारिक रिकॉर्ड रखरखाव के लिए स्टेज 3 डेटाबेस मिलान पृष्ठ पर दर्ज किए जाते हैं।",
  "Standard Revenue Mandate:": "मानक राजस्व शासनादेश:",
  "Enter mandatory officer keynotes on the final Stage 3 page before saving official judgment.":
    "अंतिम निर्णय सुरक्षित करने से पहले स्टेज 3 पृष्ठ पर अनिवार्य अधिकारी कीनोट्स दर्ज करें।",
  "Proceed to Stage 3 Final Verification": "स्टेज 3 अंतिम सत्यापन पर आगे बढ़ें",

  // Stage 3 Verification Page
  "STAGE 3": "चरण 3 (स्टेज 3)",
  "EXISTING RECORD VERIFICATION": "मौजूदा रिकॉर्ड सत्यापन",
  "Verification Status:": "सत्यापन स्थिति (स्टेटस):",
  "AWAITING EXTRACTION": "एक्सट्रैक्शन प्रतीक्षारत",
  "NO REGISTRY RECORDS": "कोई रजिस्ट्री रिकॉर्ड नहीं",
  "CONFLICTS DETECTED": "कॉन्फ्लिक्ट्स मिले (विसंगति)",
  "EXACT MATCH FOUND": "सटीक मिलान प्राप्त (एग्जैक्ट मैच)",
  "MULTIPLE MATCHES FOUND": "एकाधिक मिलान प्राप्त",
  "POSSIBLE MATCH": "संभावित मिलान (पॉसिबल मैच)",
  "PRE-SEEDED REGISTRY AVAILABLE": "बेसलाइन रजिस्ट्री उपलब्ध",
  "EXTRACTED LAND INFORMATION": "दस्तावेजों से प्राप्त भूमि विवरण",
  "DATABASE MATCH": "डेटाबेस मिलान (मैच)",
  "Matched Land Record ID:": "मिलान लैंड रिकॉर्ड आईडी:",
  "Match Strength:": "मैच स्ट्रेंथ:",
  "Confidence": "कॉन्फिडेंस",
  "Matched Parameters:": "मैच हुए पैरामीटर्स:",
  "Pre-Seeded Registry Baseline Records (Select to compare):":
    "पूर्व-निर्धारित रजिस्ट्री बेसलाइन रिकॉर्ड्स (तुलना हेतु चुनें):",
  "No Match Found": "कोई मिलान नहीं मिला",
  "FIELD-BY-FIELD COMPARISON": "फ़ील्ड-वार तुलना एवं सत्यापन",
  "Field": "फ़ील्ड",
  "Extracted Value": "एक्सट्रैक्टेड वैल्यू",
  "Existing Record Value": "एक्जिस्टिंग रिकॉर्ड वैल्यू",
  "Match Status": "मैच स्टेटस",
  "Source / Evidence": "सोर्स / एविडेंस",
  "MISMATCH (REVIEW REQUIRED)": "मिसमैच (रिव्यू रिक्वायर्ड)",
  "NIL (NOT IN EXTRACTION)": "निल (एक्सट्रैक्शन में नहीं)",
  "NIL (ABSENT FROM EXTRACTION)": "निल (एक्सट्रैक्शन से अनुपस्थित)",
  "SINGLE SOURCE (EXTRACTION ONLY)": "सिंगल सोर्स (केवल एक्सट्रैक्शन)",
  "Stage 3 Final Judgment & Record Maintenance":
    "स्टेज 3: अंतिम निर्णय एवं अभिलेख रखरखाव",
  "Officer Keynotes & Institutional Determination":
    "अधिकारी कीनोट्स एवं संस्थागत निर्णय (डिटरमिनेशन)",
  "Recorded judgment is stamped into the immutable revenue audit log with officer authorization credentials.":
    "दर्ज किया गया निर्णय अधिकारी के अधिकृत क्रेडेंशियल्स के साथ अपरिवर्तनीय राजस्व ऑडिट लॉग में मुद्रित होता है।",
  "Select Record Status Disposition": "रिकॉर्ड स्टेटस डिस्पोजिशन चुनें",
  "Consistent / Verified": "कंसिस्टेंट / वेरिफाइड (सुसंगत)",
  "Review Required / Inconsistent": "रिव्यू रिक्वायर्ड / इनकंसिस्टेंट (समीक्षा आवश्यक)",
  "Potential Conflict / Unverified": "पोटेंशियल कॉन्फ्लिक्ट / अनवेरिफाइड (संभावित विवाद)",
  "Patwari Field Verification": "पटवारी फ़ील्ड वेरिफिकेशन (मौका मुआयना)",
  "Officer Keynotes & Record Maintenance Remarks":
    "अधिकारी कीनोट्स एवं अभिलेख रखरखाव रिमार्क्स",
  "Word Count:": "शब्द संख्या:",
  "12 words minimum": "न्यूनतम 12 शब्द",
  "Enter officer keynotes (minimum 12 words required, e.g. Khasra and survey boundaries reconciled against baseline land register; deed parameters verified and consistent with state records).":
    "अधिकारी कीनोट्स दर्ज करें (न्यूनतम 12 शब्द अनिवार्य, उदा. खसरा और सर्वे सीमाएं राज्य अभिलेख बेसलाइन से सत्यापित और सुसंगत पाई गईं)।",
  "Mandatory Rule: Revenue officer keynote must contain at least 12 descriptive words before recording final judgment.":
    "अनिवार्य नियम: अंतिम निर्णय सुरक्षित करने से पहले राजस्व अधिकारी कीनोट में कम से कम 12 विवरणात्मक शब्द होने चाहिए।",
  "Create a Secure Vault for this Record": "इस अभिलेख के लिए सिक्योर वॉल्ट बनाएं",
  "Optional Add-On": "वैकल्पिक सुविधा",
  "If enabled, a consolidated Secure Vault dossier is generated for this land record. An \"Open Vault\" option will be unlocked in the Verified Records register.":
    "सक्षम होने पर, इस भू-अभिलेख के लिए एक समेकित सिक्योर वॉल्ट तैयार होता है। सत्यापित रिकॉर्ड्स में \"वॉल्ट खोलें\" का विकल्प अनलॉक होगा।",
  "Vault Reference / Security Summary (Optional)":
    "वॉल्ट संदर्भ / सुरक्षा सारांश (वैकल्पिक)",
  "Archive Enclosure": "अभिलेख संलग्नक",
  "Saving...": "सुरक्षित किया जा रहा है...",
  "Record Consistent": "रिकॉर्ड कंसिस्टेंट",
  "Review Required": "रिव्यू रिक्वायर्ड",
  "Potential Conflict": "पोटेंशियल कॉन्फ्लिक्ट",
  "Human Verification Required": "ह्यूमन वेरिफिकेशन रिक्वायर्ड",
  "Official Record Maintenance Logged • Redirecting to Workspace...":
    "आधिकारिक रिकॉर्ड दर्ज हुआ • कार्यक्षेत्र पर पुनर्निर्देशित किया जा रहा है...",

  // Land Attributes & Revenue Terminology
  "Property UID (ULPIN)": "प्रॉपर्टी यूआईडी (ULPIN)",
  "Owner": "भूस्वामी (ओनर)",
  "Owner Name": "भूस्वामी का नाम",
  "Owner Name / Title Holder": "भूस्वामी / पट्टेदार का नाम",
  "Seller": "विक्रेता",
  "Seller / Prior Owner": "विक्रेता / पूर्व भूस्वामी",
  "Buyer": "क्रेता / खरीदार",
  "Survey No.": "सर्वे क्र.",
  "Survey Number": "सर्वे नंबर",
  "Cadastral Survey Number": "भू-सर्वेक्षण (सर्वे) नंबर",
  "Khasra No.": "खसरा क्र.",
  "Khasra Number": "खसरा नंबर",
  "Khasra / Plot Number": "खसरा / प्लॉट नंबर",
  "Khata No.": "खाता क्र.",
  "Khata Number": "खाता नंबर",
  "Khatauni / Khata Number": "खतौनी / खाता नंबर",
  "Village": "ग्राम (विलेज)",
  "Village / Mauza": "ग्राम / मौजा",
  "District": "जिला (डिस्ट्रिक्ट)",
  "District / Tehsil": "जिला / तहसील",
  "State": "राज्य (स्टेट)",
  "Area": "रकबा (एरिया)",
  "Area (Ha)": "रकबा (हेक्टेयर)",
  "Land Parcel Area": "भूमि रकबा (क्षेत्रफल)",
  "Hectares": "हेक्टेयर",
  "Hectare": "हेक्टेयर",
  "ha": "हे.",
  "Acres": "एकड़",
  "Acre": "एकड़",
  "Deed Registration Number": "पंजीकरण (रजिस्ट्री) क्रमांक",
  "Registration Number": "रजिस्ट्रेशन नंबर",
  "Registration / Execution Date": "रजिस्ट्रेशन दिनांक",
  "Mutation Order Number": "नामांतरण आदेश क्रमांक",
  "Mutation Number": "म्यूटेशन नंबर",
  "Mutation Order Date": "म्यूटेशन दिनांक",
  "Active": "सक्रिय (एक्टिव)",
  "Verified": "सत्यापित (वेरिफाइड)",
  "Draft": "ड्राफ्ट",
  "Processing": "प्रोसेसिंग",

  // Audit Log & Event Descriptors
  "Immutable Case Audit Log": "अपरिवर्तनीय केस ऑडिट लॉग",
  "events": "इवेंट्स",
  "Authorized Officer:": "अधिकृत अधिकारी:",
  "RECORD_VERIFIED": "अभिलेख सत्यापित (RECORD_VERIFIED)",
  "RECORD_MARKED_FOR_REVIEW": "समीक्षा हेतु चिह्नित (REVIEW_REQUIRED)",
  "RECORD_MARKED_INCONSISTENT": "विसंगति चिह्नित (POTENTIAL_CONFLICT)",
  "DOCUMENT_UPLOADED": "दस्तावेज़ अपलोड हुआ",
  "EXTRACTION_COMPLETED": "एक्सट्रैक्शन पूर्ण",

  // Document Scanner UI
  "Optical Scan Verified • Extracted Revenue Attributes Below":
    "ऑप्टिकल स्कैन सत्यापित • उद्धृत राजस्व विवरण नीचे देखें",
  "AI Optical Scanner Active": "एआई ऑप्टिकल स्कैनर सक्रिय",
  "Document Loaded & Ready": "दस्तावेज़ लोड हुआ व तैयार है",
  "Loading Uploaded File...": "अपलोड फ़ाइल लोड हो रही है...",
  "Document Render Failed": "दस्तावेज़ रेंडरिंग विफल",
  "Unsupported Document": "असमर्थित दस्तावेज़ प्रारूप",
  "Page": "पेज",
  "of": "का",
  "Rotate Left 90°": "बाएं 90° घुमाएं",
  "Rotate Right 90°": "दाएं 90° घुमाएं",
  "Zoom Out": "ज़ूम आउट",
  "Reset Zoom": "ज़ूम रीसेट",
  "Zoom In": "ज़ूम इन",
  "Toggle Fullscreen": "फुलस्क्रीन टॉगल करें",
  "Previous Page": "पिछला पेज",
  "Next Page": "अगला पेज",
  "Processing Engine": "प्रोसेसिंग इंजन",
  "Document Analysis Pipeline": "दस्तावेज़ विश्लेषण पाइपलाइन",
  "Completed": "पूर्ण (कम्प्लीटेड)",
  "In Progress": "प्रगति पर (इन प्रोग्रेस)",
  "Document Uploaded": "दस्तावेज़ अपलोड हुआ",
  "Scanning & Analyzing": "स्कैनिंग एवं विश्लेषण",
  "Extracting Fields": "फ़ील्ड्स का निष्कर्षण (एक्सट्रैक्शन)",
  "Validating Data": "डेटा का सत्यापन (वैलिडेशन)",
  "Structured parameters ready for verification": "संरचित पैरामीटर्स सत्यापन हेतु तैयार",
  "Extracting information using Optical OCR & Vision Stream": "ऑप्टिकल ओसीआर एवं विज़न स्ट्रीम द्वारा सूचना निष्कर्षण",
  "Parsing names, survey/khasra numbers, area & details": "नाम, सर्वे/खसरा नंबर, रकबा एवं विवरण का विश्लेषण",
  "Cross-checking confidence score & revenue schemas": "कॉन्फिडेंस स्कोर व राजस्व स्कीमा से मिलान",
  "Execution Log": "निष्पादन लॉग (एग्जीक्यूशन लॉग)",
  "Live Audit Events": "लाइव ऑडिट इवेंट्स",
  "Scanning Document...": "दस्तावेज़ स्कैन हो रहा है...",
  "Re-scan Document": "दस्तावेज़ पुनः स्कैन करें",
  "Process Document": "दस्तावेज़ प्रोसेस करें",
  "View Extracted Data": "एक्सट्रैक्टेड डेटा देखें",
  "Scanned Document Registered": "स्कैन किया गया दस्तावेज़ पंजीकृत",

  // Geographic names
  "Sehore": "सीहोर",
  "Raisen": "रायसेन",
  "Vidisha": "विदिशा",
  "Bhopal": "भोपाल",
  "Sagar": "सागर",
  "Hoshangabad": "होशंगाबाद",
  "Narmadapuram": "नर्मदापुरम",
  "Ashta": "आष्टा",
  "Ichhawar": "इछावर",
  "Budhni": "बुधनी",
  "Mandideep": "मंडीदीप",
  "Obedullaganj": "ओबेदुल्लागंज",
  "Sultanpur": "सुल्तानपुर",
  "Gyaraspur": "ग्यारसपुर",
  "Basoda": "बासौदा",
  "Kurwai": "कुरवाई",
  "Barkheda": "बरखेड़ा",
  "Bilkisganj": "बिलकिसगंज",

  // Common Indian Land Owners
  "Rajesh Verma": "राजेश वर्मा",
  "Neha Patel": "नेहा पटेल",
  "Amit Sharma": "अमित शर्मा",
  "Kavita Singh": "कविता सिंह",
  "Sanjay Sharma": "संजय शर्मा",
  "Pooja Verma": "पूजा वर्मा",
  "Deepak Thakur": "दीपक ठाकुर",
  "Anjali Soni": "अंजलि सोनी",
  "Mohit Yadav": "मोहित यादव",
  "Priya Mishra": "प्रिया मिश्रा",
  "Ramesh Sharma": "रमेश शर्मा",
  "Dinesh Kumar": "दिनेश कुमार",
  "Suresh Patel": "सुरेश पटेल",
  "Radha Bai": "राधा बाई",
  "Mohan Lal": "मोहन लाल",
  "Sunita Bai": "सुनीता बाई",
};

// 2. High-Frequency English Words Dictionary for Word-By-Word Transliteration
const WORD_TRANSLITERATION_MAP: Record<string, string> = {
  // Case & workflow words
  "cases": "केसेस",
  "case": "केस",
  "overview": "ओवरव्यू",
  "audit": "ऑडिट",
  "trail": "ट्रेल",
  "records": "रिकॉर्ड्स",
  "record": "रिकॉर्ड",
  "road": "रोड",
  "construction": "कंस्ट्रक्शन",
  "first": "फर्स्ट",
  "second": "सेकंड",
  "third": "थर्ड",
  "fourth": "फोर्थ",
  "highway": "हाईवे",
  "expansion": "एक्सपेंशन",
  "corridor": "कॉरिडोर",
  "bhopal": "भोपाल",
  "sehore": "सीहोर",
  "raisen": "रायसेन",
  "vidisha": "विदिशा",
  "sagar": "सागर",
  "bairagarh": "बैरागढ़",
  "jamnagar": "जामनगर",
  "rampur": "रामपुर",
  "bamora": "बमोरा",
  "nhai": "एनएचएआई",
  "location": "लोकेशन",
  "reference": "रेफरेंस",
  "delete": "डिलीट",
  "register": "रजिस्टर",
  "praneet": "प्रणीत",
  "soni": "सोनी",
  "officer": "ऑफिसर",
  "system": "सिस्टम",
  "healthy": "हेल्दी",
  "resource": "रिसोर्स",
  "usage": "यूसेज",
  "monitor": "मॉनिटर",
  "optical": "ऑप्टिकल",
  "extraction": "एक्सट्रैक्शन",
  "completed": "कम्प्लीटेड",
  "screenshot": "स्क्रीनशॉट",
  "model": "मॉडल",
  "fields": "फ़ील्ड्स",
  "field": "फ़ील्ड",
  "mapped": "मैप्ड",
  "classified": "क्लासिफाइड",
  "document": "डॉक्यूमेंट",
  "documents": "डॉक्यूमेंट्स",
  "mutation": "म्यूटेशन",
  "initiated": "इनीशिएटेड",
  "multimodal": "मल्टीमॉडल",
  "pipeline": "पाइपलाइन",
  "for": "के लिए",
  "uploaded": "अपलोडेड",
  "upload": "अपलोड",
  "source": "सोर्स",
  "to": "को",
  "recorded": "रिकॉर्डेड",
  "judgment": "जजमेंट",
  "with": "के साथ",
  "keynote": "कीनोट",
  "keynotes": "कीनोट्स",
  "words": "शब्द",
  "this": "यह",
  "is": "है",
  "demonstration": "डेमॉन्स्ट्रेशन",
  "secure": "सिक्योर",
  "vault": "वॉल्ट",
  "established": "एस्टैब्लिश्ड",
  "cross": "क्रॉस",
  "reconciliation": "रिकॉन्सिलिएशन",
  "integrity": "इंटीग्रिटी",
  "score": "स्कोर",
  "conflicts": "कॉन्फ्लिक्ट्स",
  "conflict": "कॉन्फ्लिक्ट",
  "variance": "वेरिएंस",
  "variances": "वेरिएंसेस",
  "mismatch": "मिसमैच",
  "mismatches": "मिसमैचेस",
  "verified": "वेरिफाइड",
  "unverified": "अनवेरिफाइड",
  "matches": "मैचेस",
  "match": "मैच",
  "single": "सिंगल",
  "nil": "निल",
  "null": "नल",
  "min": "मिनट",
  "ago": "पहले",
  "hr": "घंटे",
  "just": "अभी",
  "now": "अभी",
  "search": "सर्च",
  "intake": "इंटेक",
  "open": "ओपन",
  "workspace": "वर्कस्पेस",
  "establish": "स्थापित करें",
  "new": "नया",
  "acquisition": "अधिग्रहण",
  "project": "प्रोजेक्ट",
  "village": "विलेज",
  "district": "डिस्ट्रिक्ट",
  "number": "नंबर",
  "state": "स्टेट",
  "area": "एरिया",
  "hectares": "हेक्टेयर",
  "hectare": "हेक्टेयर",
  "acres": "एकड़",
  "acre": "एकड़",
  "active": "एक्टिव",
  "draft": "ड्राफ्ट",
  "processing": "प्रोसेसिंग",
  "inconsistent": "इनकंसिस्टेंट",
  "review": "रिव्यू",
  "required": "रिक्वायर्ड",
  "consistent": "कंसिस्टेंट",
  "potential": "पोटेंशियल",
  "human": "ह्यूमन",
  "verification": "वेरिफिकेशन",
  "patwari": "पटवारी",
  "authorized": "अधिकृत",
  "check": "चेक",
  "status": "स्थिति",
  "events": "इवेंट्स",
  "event": "इवेंट",
  "entry": "एंट्री",
  "entries": "एंट्रीज",
  "by": "द्वारा",
  "and": "और",
  "of": "का",
  "in": "में",
  "on": "पर",
  "at": "पर",
  "all": "सभी",
  "view": "देखें",
  "save": "सेव",
  "saved": "सेव्ड",
  "saving": "सेविंग",
  "cancel": "कैंसल",
  "confirm": "कन्फर्म",
  "submit": "सबमिट",
  "edit": "एडिट",
  "total": "टोटल",
  "khasra": "खसरा",
  "survey": "सर्वे",
  "mauza": "मौजा",
  "khata": "खाता",
  "khatauni": "खतौनी",
  "owner": "ओनर",
  "seller": "सेलर",
  "buyer": "बायर",
  "deed": "डीड",
  "sale": "सेल",
  "registration": "रजिस्ट्रेशन",
  "proceed": "आगे बढ़ें",
  "return": "वापस जाएं",
  "evidence": "एविडेंस",
  "baseline": "बेसलाइन",
  "registry": "रजिस्ट्री",
  "concordance": "कॉनकॉर्डेंस",
  "uncorroborated": "अनकोरोबोरेटेड",
  "absent": "एब्सेंट",
  "payload": "पेलोड",
  "structured": "स्ट्रक्चर्ड",
  "attributes": "एट्रिब्यूट्स",
  "attribute": "एट्रिब्यूट",
  "value": "वैल्यू",
  "values": "वैल्यूज़",
  "found": "फाउंड",
  "present": "प्रेजेंट",
  "pending": "पेंडिंग",
  "failed": "फेल्ड",
  "complete": "कम्प्लीट",
  "hide": "छुपाएं",
  "manual": "मैनुअल",
  "ready": "रेडी",
  "dossier": "डॉसियर",
  "enclosure": "एंक्लोज़र",
  "remarks": "रिमार्क्स",
  "matrix": "मैट्रिक्स",
  "parameters": "पैरामीटर्स",
  "parameter": "पैरामीटर",
  "evaluated": "इवैल्यूएटेड",
  "ocr": "ओसीआर",
  "scanner": "स्कैनर",
  "scanning": "स्कैनिंग",
  "stream": "स्ट्रीम",
  "vision": "विज़न",
  "gemini": "जेमिनी",
  "action": "एक्शन",
  "actions": "एक्शंस",
  "type": "टाइप",
  "types": "टाइप्स",
  "filename": "फाइलनेम",
  "serial": "सीरियल",
  "size": "साइज़",
  "sources": "सोर्सेज",
  "legacy": "लेगेसी",
  "government": "गवर्नमेंट",
  "double": "डबल",
  "context": "कॉन्टेक्स्ट",
  "queue": "कतार",
  "residential": "रेजिडेंशियल",
  "agricultural": "एग्रीकल्चरल",
  "commercial": "कमर्शियल",
  "industrial": "इंडस्ट्रियल",
  "tehsildar": "तहसीलदार",
  "collector": "कलेक्टर",
  "subdivision": "सबडिवीजन",
  "bigha": "बीघा",
  "biswa": "बिस्वा",
  "sqft": "वर्गफुट",
  "claimant": "क्लेमेंट",
  "applicant": "एप्लिकेंट",
  "certificate": "सर्टिफिकेट",
  "strength": "स्ट्रेंथ",
  "confidence": "कॉन्फिडेंस",
  "candidate": "कैंडिडेट",
  "candidates": "कैंडिडेट्स",
  "comparison": "कंपैरिजन",
  "detailed": "डिटेल्ड",
  "summary": "समरी",
  "reason": "रीज़न",
  "explanation": "एक्सप्लेनेशन",
  "minimum": "मिनिमम",
  "count": "काउंट",
  "institutional": "इंस्टीट्यूशनल",
  "mandate": "मैनडेट",
  "standard": "स्टैंडर्ड",
  "revenue": "रेवेन्यू",
  "avatar": "अवतार",
  "session": "सेशन",
  "timestamp": "टाइमस्टैम्प",
  "immutable": "इम्यूटेबल",
  "history": "हिस्ट्री",
  "log": "लॉग",
  "logs": "लॉग्स",
  "stamped": "स्टैम्प्ड",
  "tamper": "टेम्पर",
  "evident": "एविडेंट",
  "download": "डाउनलोड",
  "zoom": "ज़ूम",
  "rotate": "रोटेट",
  "fullscreen": "फुलस्क्रीन",
  "page": "पेज",
  "pages": "पेजेस",
  "next": "नेक्स्ट",
  "prev": "प्रीवियस",
  "previous": "पिछला",
  "reset": "रीसेट",
  "retry": "रीट्राई",
  "close": "क्लोज़",
  "select": "सेलेक्ट",
  "selected": "सेलेक्टेड",
  "batch": "बैच",
  "non-land": "गैर-भूमि",
  "irrelevant": "अप्रासंगिक",
  "ramesh": "रमेश",
  "sharma": "शर्मा",
  "dinesh": "दिनेश",
  "kumar": "कुमार",
  "suresh": "सुरेश",
  "patel": "पटेल",
  "verma": "वर्मा",
  "singh": "सिंह",
  "radha": "राधा",
  "bai": "बाई",
  "mohan": "मोहन",
  "lal": "लाल",
  "sunita": "सुनीता",
};

// 3. Phonetic Devanagari transliteration engine for ANY unknown English word
function phoneticTransliterateWord(rawWord: string): string {
  if (!rawWord) return "";
  const lower = rawWord.toLowerCase();
  if (WORD_TRANSLITERATION_MAP[lower]) {
    return WORD_TRANSLITERATION_MAP[lower];
  }

  // Common consonant combinations
  let s = lower;
  s = s.replace(/tion/g, "शन");
  s = s.replace(/sion/g, "शन");
  s = s.replace(/ture/g, "चर");
  s = s.replace(/ment/g, "मेंट");
  s = s.replace(/ness/g, "नेस");
  s = s.replace(/ing/g, "िंग");
  s = s.replace(/str/g, "स्ट्र");
  s = s.replace(/scr/g, "स्क्र");
  s = s.replace(/spr/g, "स्प्र");
  s = s.replace(/spl/g, "स्प्ल");
  s = s.replace(/st/g, "स्ट");
  s = s.replace(/sp/g, "स्प");
  s = s.replace(/sc/g, "स्क");
  s = s.replace(/sk/g, "स्क");
  s = s.replace(/sm/g, "स्म");
  s = s.replace(/sn/g, "स्न");
  s = s.replace(/sl/g, "स्ल");
  s = s.replace(/sw/g, "स्व");
  s = s.replace(/sh/g, "श");
  s = s.replace(/ch/g, "च");
  s = s.replace(/th/g, "थ");
  s = s.replace(/ph/g, "फ");
  s = s.replace(/gh/g, "घ");
  s = s.replace(/kh/g, "ख");
  s = s.replace(/bh/g, "भ");
  s = s.replace(/dh/g, "ध");
  s = s.replace(/jh/g, "झ");
  s = s.replace(/wh/g, "व्ह");
  s = s.replace(/tr/g, "ट्र");
  s = s.replace(/dr/g, "ड्र");
  s = s.replace(/pr/g, "प्र");
  s = s.replace(/br/g, "ब्र");
  s = s.replace(/cr/g, "क्र");
  s = s.replace(/gr/g, "ग्र");
  s = s.replace(/fr/g, "फ्र");
  s = s.replace(/cl/g, "क्ल");
  s = s.replace(/gl/g, "ग्‍ल");
  s = s.replace(/pl/g, "प्ल");
  s = s.replace(/bl/g, "ब्ल");
  s = s.replace(/fl/g, "फ़्ल");
  s = s.replace(/ck/g, "क");
  s = s.replace(/ct/g, "क्ट");
  s = s.replace(/pt/g, "प्ट");
  s = s.replace(/ft/g, "फ़्ट");
  s = s.replace(/lt/g, "ल्ट");
  s = s.replace(/mp/g, "म्प");
  s = s.replace(/nt/g, "न्ट");
  s = s.replace(/nd/g, "न्ड");
  s = s.replace(/nk/g, "न्क");
  s = s.replace(/ng/g, "ंग");

  // Vowels
  s = s.replace(/ee/g, "ी");
  s = s.replace(/ea/g, "ी");
  s = s.replace(/oo/g, "ू");
  s = s.replace(/ai/g, "ै");
  s = s.replace(/ay/g, "े");
  s = s.replace(/au/g, "ौ");
  s = s.replace(/ou/g, "ाउ");
  s = s.replace(/oa/g, "ो");

  // Single letters
  s = s.replace(/b/g, "ब");
  s = s.replace(/c/g, "क");
  s = s.replace(/d/g, "ड");
  s = s.replace(/f/g, "फ");
  s = s.replace(/g/g, "ग");
  s = s.replace(/h/g, "ह");
  s = s.replace(/j/g, "ज");
  s = s.replace(/k/g, "क");
  s = s.replace(/l/g, "ल");
  s = s.replace(/m/g, "म");
  s = s.replace(/n/g, "न");
  s = s.replace(/p/g, "प");
  s = s.replace(/q/g, "क");
  s = s.replace(/r/g, "र");
  s = s.replace(/s/g, "स");
  s = s.replace(/t/g, "ट");
  s = s.replace(/v/g, "व");
  s = s.replace(/w/g, "व");
  s = s.replace(/x/g, "क्स");
  s = s.replace(/y/g, "य");
  s = s.replace(/z/g, "ज़");
  s = s.replace(/a/g, "ा");
  s = s.replace(/e/g, "े");
  s = s.replace(/i/g, "ि");
  s = s.replace(/o/g, "ो");
  s = s.replace(/u/g, "ु");

  return s;
}

// Transcribe tokens that might be compound identifiers (e.g. road_construction -> रोड_कंस्ट्रक्शन)
function transcribeToken(token: string): string {
  if (!token) return "";
  const lower = token.toLowerCase();

  // If token is in dictionary
  if (WORD_TRANSLITERATION_MAP[lower]) {
    return WORD_TRANSLITERATION_MAP[lower];
  }
  if (TRANSLATION_DICTIONARY[token]) {
    return TRANSLATION_DICTIONARY[token];
  }

  // If it's a number or code with numbers like LA-2026-33676, keep intact
  if (/^[A-Za-z0-9]+-[A-Za-z0-9-]+$/.test(token) || /^\d+$/.test(token)) {
    return token;
  }

  // If pure English word, transliterate it
  if (/^[A-Za-z]+$/.test(token)) {
    return phoneticTransliterateWord(token);
  }

  return token;
}

// Universal English -> Hindi Text Transcriber
export function translateText(text: string | null | undefined, lang: AppLanguage): string {
  if (!text) return "";
  if (lang === "en") return text;

  const trimmed = text.trim();
  if (!trimmed) return text;

  // 1. Direct dictionary match
  if (TRANSLATION_DICTIONARY[trimmed]) {
    return TRANSLATION_DICTIONARY[trimmed];
  }

  // Case-insensitive direct match
  const lower = trimmed.toLowerCase();
  for (const [enKey, hiVal] of Object.entries(TRANSLATION_DICTIONARY)) {
    if (enKey.toLowerCase() === lower) {
      return hiVal;
    }
  }

  // 2. Tokenize by words, underscores, hyphens, and delimiters
  // This handles compounds like "road_construction", "bhopal_road_construction", "second_case", "RECORD_MARKED_INCONSISTENT"
  const tokens = trimmed.split(/([A-Za-z0-9]+|[_\-\s.,/\\:;()[\]"'#+]+)/).filter(Boolean);

  let result = "";
  for (const token of tokens) {
    if (/^[A-Za-z]+$/.test(token)) {
      result += transcribeToken(token);
    } else {
      // It's a delimiter (like "_", "-", " / ", " ") or numbers/symbols
      result += token;
    }
  }

  // Cleanups
  result = result.replace(/_मार्क्ड_/g, " मार्क्ड ");
  result = result.replace(/_चेक_/g, " चेक ");

  return result || trimmed;
}

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  toggleLanguage: () => {},
  isHindi: false,
  t: (text) => text || "",
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => {
    try {
      const stored = localStorage.getItem("vv_preferred_language");
      return stored === "hi" ? "hi" : "en";
    } catch {
      return "en";
    }
  });

  const setLanguage = (lang: AppLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("vv_preferred_language", lang);
      document.documentElement.lang = lang;
    } catch {
      // storage unavailable
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "hi" : "en");
  };

  useEffect(() => {
    try {
      document.documentElement.lang = language;
    } catch {
      // ignore
    }
  }, [language]);

  const isHindi = language === "hi";

  const t = useMemo(() => {
    return (text: string | null | undefined): string => {
      return translateText(text, language);
    };
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isHindi, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Reusable Language Toggle Pill Button
 */
export function LanguageToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { language, toggleLanguage, isHindi } = useLanguage();

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      data-testid="button-language-toggle"
      aria-label="Toggle language between English and Hindi"
      title={isHindi ? "Switch to English / अंग्रेज़ी में देखें" : "Switch to Hindi / हिन्दी में देखें"}
      className={`group inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all hover:border-primary/50 hover:bg-secondary/70 active:scale-95 ${
        isHindi
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-medium"
          : "text-foreground"
      } ${className}`}
    >
      <span className="text-sm leading-none" role="img" aria-label="globe">🌐</span>
      <div className="flex items-center gap-1.5">
        <span className={`transition-colors ${isHindi ? "text-muted-foreground font-normal" : "text-primary font-bold"}`}>
          EN
        </span>
        <span className="text-border">/</span>
        <span className={`transition-colors ${isHindi ? "text-emerald-700 dark:text-emerald-300 font-bold" : "text-muted-foreground font-normal"}`}>
          हिन्दी
        </span>
      </div>
      {!compact && (
        <span className="hidden xl:inline text-[11px] text-muted-foreground ml-0.5">
          ({isHindi ? "अनुवाद सक्रिय" : "Translate"})
        </span>
      )}
    </button>
  );
}
