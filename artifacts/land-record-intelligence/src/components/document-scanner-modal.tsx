import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  X,
  RefreshCw,
  Check,
  Zap,
  ZapOff,
  SwitchCamera,
  RotateCcw,
  RotateCw,
  Trash2,
  Plus,
  Sparkles,
  Layers,
  FileText,
  Scan,
  Download,
  ArrowLeft,
  ArrowRight,
  Sliders,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/language-context";
import type { DocumentType } from "@/lib/types";
import { useCamera } from "@/hooks/useCamera";
import {
  FilterMode,
  applyImageFilter,
  compressCanvasToJpeg,
  generateCompiledPdf,
  ProcessedImageResult
} from "@/lib/imageFilters";
import { uploadDocumentFile } from "@/lib/storage";
import { createCaseDocument } from "@/lib/firestore";
import { saveDocumentBlob } from "@/lib/idb-storage";

export interface DocumentScannerModalProps {
  caseId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploaded?: () => void;
  defaultDocType?: DocumentType;
}

export interface CapturedScanPage {
  id: string;
  rawCanvas: HTMLCanvasElement;
  filterMode: FilterMode;
  rotation: number; // 0, 90, 180, 270
  processed: ProcessedImageResult;
  timestamp: number;
}

export function DocumentScannerModal({
  caseId,
  isOpen,
  onClose,
  onUploaded,
  defaultDocType = "SALE_DEED"
}: DocumentScannerModalProps) {
  const { t } = useLanguage();

  // Initialize Custom Camera Hook for Real Device Hardware
  const {
    videoRef,
    stream,
    hasPermission,
    isLoading,
    facingMode,
    torchOn,
    supportsTorch,
    devices,
    selectedDeviceId,
    cameraError,
    startCamera,
    stopCamera,
    toggleTorch,
    switchCamera,
    selectDevice
  } = useCamera({ idealFacingMode: "environment", idealWidth: 1920, idealHeight: 1080 });

  // Scan Session State
  const [capturedPages, setCapturedPages] = useState<CapturedScanPage[]>([]);
  const [activePageIndex, setActivePageIndex] = useState<number | null>(null);
  const [isReviewingPage, setIsReviewingPage] = useState<boolean>(false);
  const [isCapturing, setIsCapturing] = useState<boolean>(false);

  // Active Review Page Adjustments
  const [activeFilter, setActiveFilter] = useState<FilterMode>("magic_color");
  const [activeRotation, setActiveRotation] = useState<number>(0);

  // Document Metadata & Save Progress
  const [docType, setDocType] = useState<DocumentType>(defaultDocType);
  const [docTitle, setDocTitle] = useState<string>("");
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveProgress, setSaveProgress] = useState<number>(0);

  // Manage Camera Stream Lifecycle on Modal Open/Close
  useEffect(() => {
    if (isOpen) {
      const dateStr = new Date().toISOString().slice(0, 10);
      setDocTitle(`Live_Scan_Deed_${dateStr}_${Math.floor(Math.random() * 1000)}`);
      startCamera();
    } else {
      stopCamera();
    }
  }, [isOpen, startCamera, stopCamera]);

  // Capture Instant Frame from Real Hardware Camera Video Stream
  const handleCaptureShutter = useCallback(async () => {
    // Haptic feedback for touch devices
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch {}
    }

    setIsCapturing(true);

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      setIsCapturing(false);
      return;
    }

    const srcCanvas = document.createElement("canvas");
    srcCanvas.width = video.videoWidth || 1920;
    srcCanvas.height = video.videoHeight || 1080;
    const ctx = srcCanvas.getContext("2d");
    if (!ctx) {
      setIsCapturing(false);
      return;
    }

    // Capture raw camera video frame
    ctx.drawImage(video, 0, 0, srcCanvas.width, srcCanvas.height);

    // Apply default "Magic Color" contrast & paper brightening filter
    const filteredCanvas = applyImageFilter(srcCanvas, "magic_color", 0);
    const processed = await compressCanvasToJpeg(filteredCanvas, 1600, 0.75);

    const newPage: CapturedScanPage = {
      id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      rawCanvas: srcCanvas,
      filterMode: "magic_color",
      rotation: 0,
      processed,
      timestamp: Date.now()
    };

    setCapturedPages((prev) => [...prev, newPage]);
    setActivePageIndex(capturedPages.length); // Focus newly captured page
    setActiveFilter("magic_color");
    setActiveRotation(0);
    setIsReviewingPage(true);
    setIsCapturing(false);
  }, [videoRef, capturedPages.length]);

  // Handle Photo File Upload Selection
  const handlePhotoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const img = new Image();
      img.onload = async () => {
        const srcCanvas = document.createElement("canvas");
        srcCanvas.width = img.width || 1200;
        srcCanvas.height = img.height || 1600;
        const ctx = srcCanvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }

        const filteredCanvas = applyImageFilter(srcCanvas, "magic_color", 0);
        const processed = await compressCanvasToJpeg(filteredCanvas, 1600, 0.75);

        const newPage: CapturedScanPage = {
          id: `page-${Date.now()}`,
          rawCanvas: srcCanvas,
          filterMode: "magic_color",
          rotation: 0,
          processed,
          timestamp: Date.now()
        };

        setCapturedPages((prev) => [...prev, newPage]);
        setActivePageIndex(capturedPages.length);
        setActiveFilter("magic_color");
        setActiveRotation(0);
        setIsReviewingPage(true);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Generate a high-resolution sample deed canvas for OCR testing
  const handleGenerateSampleDeed = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1600;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background parchment
    ctx.fillStyle = "#fcfaf7";
    ctx.fillRect(0, 0, 1200, 1600);

    // Border and Header Stamp
    ctx.strokeStyle = "#854d0e";
    ctx.lineWidth = 6;
    ctx.strokeRect(40, 40, 1120, 1520);
    ctx.strokeRect(48, 48, 1104, 1504);

    // Header Emblem text
    ctx.fillStyle = "#1e293b";
    ctx.font = "bold 30px serif";
    ctx.textAlign = "center";
    ctx.fillText("मध्यप्रदेश शासन - राजस्व विभाग", 600, 110);
    ctx.font = "bold 22px sans-serif";
    ctx.fillText("GOVERNMENT OF MADHYA PRADESH - REVENUE DEPARTMENT", 600, 150);

    // Seal / Stamp
    ctx.beginPath();
    ctx.arc(600, 230, 46, 0, Math.PI * 2);
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#1d4ed8";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText("OFFICIAL REVENUE SEAL", 600, 235);

    // Title
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 34px serif";
    ctx.fillText("विक्रय विलेख (REGISTERED SALE DEED)", 600, 325);

    // Key Land Attributes
    ctx.textAlign = "left";
    ctx.font = "bold 22px monospace";
    ctx.fillStyle = "#334155";
    ctx.fillText("REGISTRATION NO : MP-2026-REG-778401", 100, 410);
    ctx.fillText("DISTRICT/TEHSIL  : SEHORE / ASHTA", 100, 450);
    ctx.fillText("VILLAGE / MAUZA  : BILKISGANJ", 100, 490);
    ctx.fillText("KHASRA NUMBER    : 142/2", 100, 530);
    ctx.fillText("KHATAUNI NUMBER  : 89", 100, 570);
    ctx.fillText("PARCEL AREA      : 1.450 HECTARES", 100, 610);
    ctx.fillText("TITLE HOLDER     : RAJESH VERMA S/O RAMESH VERMA", 100, 650);
    ctx.fillText("MUTATION STATUS  : PENDING VERIFICATION", 100, 690);

    // Decorative Lines & Legal Body Text
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(100, 730);
    ctx.lineTo(1100, 730);
    ctx.stroke();

    ctx.font = "18px serif";
    ctx.fillStyle = "#475569";
    const bodyLines = [
      "यह दस्तावेज़ प्रमाणित करता है कि मौजा बिलकिसगंज स्थित खसरा नंबर 142/2 का संपूर्ण स्वामीत्व अधिकार",
      "विक्रेता द्वारा नियमानुसार पंजीकृत विक्रय विलेख संख्या MP-2026-REG-778401 के तहत हस्तांतरित किया गया है।",
      "उक्त भूमि का रकबा 1.450 हेक्टेयर है एवं यह किसी भी प्रकार के ऋणभार अथवा विवाद से पूर्णतः मुक्त है।",
      "राजस्व अभिलेख बेसलाइन एवं सीमांकन का सत्यापन डिजिटल इंटेलिजेंस सत्यापन तंत्र द्वारा किया जा रहा है।"
    ];
    bodyLines.forEach((line, idx) => {
      ctx.fillText(line, 100, 780 + idx * 40);
    });

    // Sub-Registrar Seal box
    ctx.strokeStyle = "#0284c7";
    ctx.strokeRect(800, 1180, 260, 150);
    ctx.font = "italic bold 18px sans-serif";
    ctx.fillStyle = "#0369a1";
    ctx.fillText("Sub-Registrar Seal", 820, 1220);

    const filteredCanvas = applyImageFilter(canvas, "magic_color", 0);
    const processed = await compressCanvasToJpeg(filteredCanvas, 1600, 0.75);

    const newPage: CapturedScanPage = {
      id: `page-sample-${Date.now()}`,
      rawCanvas: canvas,
      filterMode: "magic_color",
      rotation: 0,
      processed,
      timestamp: Date.now()
    };

    setCapturedPages((prev) => [...prev, newPage]);
    setActivePageIndex(capturedPages.length);
    setActiveFilter("magic_color");
    setActiveRotation(0);
    setIsReviewingPage(true);
  };

  // Update Filter or Rotation on Active Review Page
  const applyActivePageAdjustments = useCallback(
    async (filter: FilterMode, rotation: number) => {
      if (activePageIndex === null || !capturedPages[activePageIndex]) return;

      const currentPage = capturedPages[activePageIndex];
      const filteredCanvas = applyImageFilter(currentPage.rawCanvas, filter, rotation);
      const processed = await compressCanvasToJpeg(filteredCanvas, 1600, 0.75);

      setCapturedPages((prev) => {
        const next = [...prev];
        next[activePageIndex] = {
          ...currentPage,
          filterMode: filter,
          rotation,
          processed
        };
        return next;
      });
    },
    [activePageIndex, capturedPages]
  );

  // Filter selection handler
  const handleFilterSelect = (filter: FilterMode) => {
    setActiveFilter(filter);
    applyActivePageAdjustments(filter, activeRotation);
  };

  // Rotation handler
  const handleRotate = (direction: "left" | "right") => {
    const nextRot = direction === "right" ? (activeRotation + 90) % 360 : (activeRotation - 90 + 360) % 360;
    setActiveRotation(nextRot);
    applyActivePageAdjustments(activeFilter, nextRot);
  };

  // Retake current active page
  const handleRetakePage = () => {
    if (activePageIndex === null) return;
    setCapturedPages((prev) => prev.filter((_, idx) => idx !== activePageIndex));
    setActivePageIndex(null);
    setIsReviewingPage(false);
  };

  // Reorder page position
  const handleMovePage = (fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= capturedPages.length) return;
    setCapturedPages((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(toIdx, 0, moved);
      return copy;
    });
    setActivePageIndex(toIdx);
  };

  // Delete specific page
  const handleDeletePage = (idx: number) => {
    setCapturedPages((prev) => prev.filter((_, i) => i !== idx));
    if (activePageIndex === idx) {
      setActivePageIndex(null);
      setIsReviewingPage(false);
    } else if (activePageIndex !== null && activePageIndex > idx) {
      setActivePageIndex(activePageIndex - 1);
    }
  };

  // Export Multi-Page Document, Save Blobs, & Trigger Gemini OCR
  const handleSaveAndFinish = async () => {
    if (capturedPages.length === 0) return;

    setIsSaving(true);
    setSaveProgress(10);

    try {
      // 1. Compile Client-Side Multi-Page PDF
      const pdfBlob = await generateCompiledPdf(
        capturedPages.map((p) => ({ dataUrl: p.processed.dataUrl })),
        docTitle.trim() || "Scanned_Land_Deed"
      );

      setSaveProgress(30);

      // 2. Save pages & upload files
      for (let i = 0; i < capturedPages.length; i++) {
        const page = capturedPages[i];
        const pageNumSuffix = capturedPages.length > 1 ? `_Page_${i + 1}` : "";
        const cleanName = (docTitle.trim() || `Live_Scan_Deed_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, "_");
        const finalFileName = `${cleanName}${pageNumSuffix}.jpg`;

        const file = new File([page.processed.blob], finalFileName, { type: "image/jpeg" });
        const docId = `doc-cam-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;

        const basePct = 30 + Math.round((i / capturedPages.length) * 50);
        setSaveProgress(basePct);

        // Cache local blob in IndexedDB for instant preview & extraction
        await saveDocumentBlob(docId, page.processed.dataUrl, "image/jpeg", finalFileName);

        // Upload to Firebase Storage
        const { storagePath, fileUrl } = await uploadDocumentFile({
          caseId,
          documentId: docId,
          file,
          onProgress: (p) => setSaveProgress(basePct + Math.round((p / 100) * (40 / capturedPages.length))),
        });

        // Register document in Firestore
        await createCaseDocument({
          id: docId,
          caseId,
          documentType: docType,
          fileName: finalFileName,
          storagePath,
          fileUrl,
          fileSize: file.size,
          mimeType: "image/jpeg",
          isDemo: false,
        });

        // Trigger Gemini OCR Extraction immediately
        try {
          fetch("/api/process-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId: docId, caseId }),
          }).catch((err) => console.warn("[DocumentScannerModal] Gemini request dispatched:", err));
        } catch {}
      }

      setSaveProgress(100);

      setTimeout(() => {
        setIsSaving(false);
        setCapturedPages([]);
        if (onUploaded) onUploaded();
        onClose();
      }, 500);
    } catch (err: any) {
      console.error("Error exporting scanned document:", err);
      setIsSaving(false);
      alert(t("Failed to save scanned document. Please check connection and try again."));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-2 sm:p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl h-[92vh] max-h-[840px] rounded-2xl border border-neutral-800 bg-neutral-950 text-neutral-100 shadow-2xl overflow-hidden">
        
        {/* HEADER TOOLBAR */}
        <header className="flex items-center justify-between border-b border-neutral-800 bg-neutral-900/90 px-4 py-3 z-30">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <Scan size={20} className="animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white">
                  {t("Live Document Scanner")}
                </h3>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30 uppercase flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  {hasPermission ? t("REAL DEVICE CAMERA ACTIVE") : t("DEVICE CAMERA SETUP")}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 hidden sm:block">
                {t("Align Sale Deed, Khasra, or Revenue Registry within A4 viewfinder frame.")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="button-close-document-scanner"
            className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </header>

        {/* MAIN BODY WORKSPACE */}
        <div className="relative flex-1 flex flex-col lg:flex-row overflow-hidden bg-neutral-950">
          
          {/* CAMERA VIEWFINDER OR PAGE ENHANCEMENT REVIEW AREA */}
          <div className="relative flex-1 flex flex-col justify-center items-center bg-neutral-900 overflow-hidden min-h-[380px]">
            
            {/* REVIEW & ENHANCEMENT MODE */}
            {isReviewingPage && activePageIndex !== null && capturedPages[activePageIndex] ? (
              <div className="relative w-full h-full flex flex-col items-center justify-between p-4 bg-neutral-950 overflow-hidden">
                
                {/* PROCESSED PAGE PREVIEW */}
                <div className="relative flex-1 w-full flex items-center justify-center overflow-hidden p-2">
                  <img
                    src={capturedPages[activePageIndex].processed.dataUrl}
                    alt={`Page ${activePageIndex + 1}`}
                    className="max-h-full max-w-full object-contain rounded-xl shadow-2xl border border-neutral-800 transition-all duration-200"
                  />
                  <div className="absolute top-4 left-4 rounded-lg bg-black/80 backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-white border border-white/20 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-400" />
                    <span>
                      {t("Page")} {activePageIndex + 1} {t("of")} {capturedPages.length} • {capturedPages[activePageIndex].processed.sizeKb} KB
                    </span>
                  </div>
                </div>

                {/* ENHANCEMENT FILTER & ROTATION TOOLBAR */}
                <div className="w-full max-w-lg bg-neutral-900/90 border border-neutral-800 rounded-2xl p-3 backdrop-blur-md space-y-3 z-20 shadow-2xl">
                  
                  {/* Filter Chips */}
                  <div className="flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleFilterSelect("magic_color")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        activeFilter === "magic_color"
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      <Sparkles size={13} />
                      <span>{t("Magic Color")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterSelect("bw")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                        activeFilter === "bw"
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      <FileText size={13} />
                      <span>{t("Crisp B&W")}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFilterSelect("original")}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                        activeFilter === "original"
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
                      }`}
                    >
                      <span>{t("Original")}</span>
                    </button>
                  </div>

                  {/* Rotation & Retake Controls */}
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRotate("left")}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1 transition"
                        title="Rotate Left 90°"
                      >
                        <RotateCcw size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRotate("right")}
                        className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-semibold flex items-center gap-1 transition"
                        title="Rotate Right 90°"
                      >
                        <RotateCw size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={handleRetakePage}
                        className="p-2 px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <Trash2 size={14} />
                        <span>{t("Retake")}</span>
                      </button>
                    </div>

                    <Button
                      type="button"
                      onClick={() => setIsReviewingPage(false)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg gap-1.5"
                    >
                      <Plus size={15} />
                      <span>{t("Add Next Page")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            ) : hasPermission === true ? (
              /* REAL HARDWARE CAMERA VIEWFINDER MODE */
              <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden select-none">
                
                {/* Hardware Video Stream Element */}
                <video
                  ref={(el) => {
                    (videoRef as any).current = el;
                    if (el && stream && el.srcObject !== stream) {
                      el.srcObject = stream;
                      el.play().catch(() => {});
                    }
                  }}
                  playsInline
                  muted
                  autoPlay
                  className="w-full h-full object-contain"
                />

                {/* Shutter Flash Animation */}
                {isCapturing && (
                  <div className="absolute inset-0 bg-white/85 animate-out fade-out duration-300 z-30 pointer-events-none" />
                )}

                {/* A4 DOCUMENT GUIDE BOX & ALIGNMENT OVERLAY */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 sm:p-10 z-10">
                  <div className="relative w-full max-w-[580px] aspect-[1/1.414] max-h-[82%] rounded-xl border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] transition-all">
                    
                    {/* Viewfinder Corner Accents */}
                    <div className="absolute -top-1 -left-1 h-6 w-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                    <div className="absolute -top-1 -right-1 h-6 w-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                    <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                    <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

                    {/* Alignment Reticle */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-40">
                      <div className="h-8 w-[1px] bg-emerald-300" />
                      <div className="w-8 h-[1px] bg-emerald-300" />
                    </div>

                    {/* Bottom Guide Badge */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/80 px-4 py-1.5 text-[11px] font-semibold text-emerald-300 border border-emerald-500/40 backdrop-blur-md whitespace-nowrap shadow-lg flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                      <span>{t("Align A4 deed paper within translucent box")}</span>
                    </div>
                  </div>
                </div>

                {/* TOP VIEWFINDER CONTROLS */}
                <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-auto">
                  <button
                    type="button"
                    onClick={toggleTorch}
                    className={`p-2.5 rounded-xl backdrop-blur-md border transition text-xs font-semibold flex items-center gap-1.5 ${
                      torchOn
                        ? "bg-amber-500 text-neutral-950 border-amber-400 shadow-lg"
                        : "bg-black/60 text-white border-white/20 hover:bg-black/80"
                    }`}
                  >
                    {torchOn ? <Zap size={16} /> : <ZapOff size={16} />}
                    <span className="hidden sm:inline">{torchOn ? t("Flash On") : t("Flash Off")}</span>
                  </button>

                  {devices.length > 1 && (
                    <select
                      value={selectedDeviceId}
                      onChange={(e) => selectDevice(e.target.value)}
                      className="bg-black/60 text-white border border-white/20 rounded-xl px-2.5 py-1.5 text-xs font-semibold backdrop-blur-md focus:outline-none"
                    >
                      {devices.map((d, i) => (
                        <option key={d.deviceId} value={d.deviceId} className="bg-neutral-900 text-white">
                          {d.label || `Camera ${i + 1}`}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={switchCamera}
                    className="p-2.5 rounded-xl bg-black/60 text-white border border-white/20 hover:bg-black/80 backdrop-blur-md transition text-xs font-semibold flex items-center gap-1.5"
                  >
                    <SwitchCamera size={16} />
                    <span className="hidden sm:inline">{facingMode === "environment" ? t("Rear Cam") : t("Front Cam")}</span>
                  </button>
                </div>

                {/* TOUCH-FRIENDLY SHUTTER BUTTON */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-4 pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleCaptureShutter}
                    disabled={isCapturing}
                    data-testid="button-shutter-capture"
                    className="group relative flex h-16 w-16 items-center justify-center rounded-full bg-white p-1 shadow-2xl transition hover:scale-105 active:scale-95"
                    title={t("Capture Land Record Page")}
                  >
                    <span className="h-full w-full rounded-full border-4 border-emerald-600 bg-emerald-500 transition group-hover:bg-emerald-400 flex items-center justify-center text-white">
                      <Camera size={26} />
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* EXPLICIT ALLOW CAMERA ACCESS REQUEST / PERMISSION PROMPT SCREEN */
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-neutral-950/95 backdrop-blur-md space-y-5 max-w-lg mx-auto">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 shadow-xl">
                  <Camera size={36} />
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500" />
                  </span>
                </div>

                <div className="space-y-2">
                  <h4 className="text-lg font-bold text-white">
                    {t("Allow Device Camera Access")}
                  </h4>
                  <p className="text-xs text-neutral-400 leading-relaxed max-w-sm mx-auto">
                    {cameraError || t("To scan physical land deeds live, please click 'Allow & Open Camera' to trigger your device camera.")}
                  </p>
                </div>

                <div className="w-full space-y-2.5 pt-2">
                  <Button
                    type="button"
                    onClick={startCamera}
                    disabled={isLoading}
                    data-testid="button-allow-camera-start"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm py-3.5 rounded-xl shadow-xl gap-2 transition active:scale-95"
                  >
                    {isLoading ? (
                      <RefreshCw size={18} className="animate-spin" />
                    ) : (
                      <Camera size={18} />
                    )}
                    <span>{isLoading ? t("Initializing Camera...") : t("Allow & Open Camera")}</span>
                  </Button>

                  {/* Open in New Tab option (Bypasses parent iframe security sandbox restrictions) */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.open(window.location.href, "_blank");
                      }
                    }}
                    data-testid="button-open-new-tab-camera"
                    className="w-full border-emerald-500/30 bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 font-semibold text-xs py-3 rounded-xl gap-2 transition"
                  >
                    <ExternalLink size={15} />
                    <span>{t("Open App in New Tab for Live Camera")}</span>
                  </Button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-neutral-800" />
                    <span className="flex-shrink mx-3 text-[10px] font-mono uppercase text-neutral-500">
                      {t("Or Select Photo File")}
                    </span>
                    <div className="flex-grow border-t border-neutral-800" />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 cursor-pointer transition">
                      <ImageIcon size={16} className="text-emerald-400" />
                      <span>{t("Select Photo File")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoFileSelect}
                      />
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateSampleDeed}
                      data-testid="button-generate-sample-deed"
                      className="border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-semibold text-xs py-2.5 rounded-xl transition gap-1.5"
                    >
                      <Sparkles size={14} className="text-emerald-400" />
                      <span>{t("Generate Sample Deed")}</span>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: MULTI-PAGE REEL & EXPORT ACTIONS */}
          <div className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900/90 p-4 flex flex-col justify-between overflow-y-auto">
            <div className="space-y-4">
              
              {/* REVENUE METADATA INPUTS */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    {t("Revenue Deed Class")}
                  </label>
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value as DocumentType)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="SALE_DEED">{t("Sale Deed (विक्रय विलेख)")}</option>
                    <option value="KHASRA">{t("Khasra Record (खसरा खतौनी)")}</option>
                    <option value="MUTATION_ORDER">{t("Mutation Order (नामांतरण आदेश)")}</option>
                    <option value="KHATAUNI">{t("Khatauni Register (खाता खतौनी)")}</option>
                    <option value="MAP">{t("Cadastral Map (भू-नक्शा)")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-1">
                    {t("Document Title / Label")}
                  </label>
                  <input
                    type="text"
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. Sale_Deed_Khasra_142"
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-medium text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* MULTI-PAGE REEL CAROUSEL */}
              <div className="space-y-2 pt-2 border-t border-neutral-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-300 flex items-center gap-1.5">
                    <Layers size={14} className="text-emerald-400" />
                    {t("Multi-Page Session")}
                  </span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-400 border border-emerald-500/30">
                    {capturedPages.length} {t("Pages")}
                  </span>
                </div>

                {capturedPages.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/50 p-6 text-center space-y-2">
                    <Camera size={24} className="mx-auto text-neutral-600" />
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {t("No pages captured yet. Align deed inside box and click the round shutter button.")}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                    {capturedPages.map((page, idx) => (
                      <div
                        key={page.id}
                        onClick={() => {
                          setActivePageIndex(idx);
                          setActiveFilter(page.filterMode);
                          setActiveRotation(page.rotation);
                          setIsReviewingPage(true);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-xl border bg-black/60 transition cursor-pointer ${
                          activePageIndex === idx && isReviewingPage
                            ? "border-emerald-400 ring-1 ring-emerald-400/40"
                            : "border-neutral-800 hover:border-neutral-700"
                        }`}
                      >
                        <div className="relative h-14 w-11 rounded overflow-hidden border border-neutral-800 flex-shrink-0 bg-neutral-900">
                          <img
                            src={page.processed.dataUrl}
                            alt={`Page ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute bottom-0 left-0 right-0 bg-black/80 text-[9px] font-bold text-center text-white py-0.5">
                            P.{idx + 1}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white truncate">
                              Page {idx + 1}
                            </span>
                            <span className="text-[10px] uppercase font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                              {page.filterMode}
                            </span>
                          </div>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {page.processed.sizeKb} KB • {page.rotation}° Rot
                          </p>
                        </div>

                        {/* Page Reel Controls */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMovePage(idx, idx - 1);
                            }}
                            disabled={idx === 0}
                            className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                            title="Move Up"
                          >
                            <ChevronLeft size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMovePage(idx, idx + 1);
                            }}
                            disabled={idx === capturedPages.length - 1}
                            className="p-1 text-neutral-400 hover:text-white disabled:opacity-30"
                            title="Move Down"
                          >
                            <ChevronRight size={14} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePage(idx);
                            }}
                            className="p-1 text-red-400 hover:text-red-300"
                            title="Delete Page"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* SAVE & EXPORT BUTTON */}
            <div className="pt-4 border-t border-neutral-800 space-y-2">
              {isSaving && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px] text-neutral-400 font-medium">
                    <span>{t("Uploading & Processing PDF…")}</span>
                    <span>{saveProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${saveProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <Button
                type="button"
                disabled={capturedPages.length === 0 || isSaving}
                onClick={handleSaveAndFinish}
                data-testid="button-save-finish-document"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-3.5 rounded-xl shadow-xl gap-2 transition disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{t("Generating PDF & Processing…")}</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    <span>
                      {t("Save & Finish")} ({capturedPages.length} {t("Pages")})
                    </span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
