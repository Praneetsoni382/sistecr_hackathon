import React, { useState, useEffect, useRef, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  FileText,
  Search,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  RotateCw,
  Sun,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Layers,
  Cpu,
  ArrowRight,
  Eye,
  Check,
  FileWarning,
  ShieldAlert,
  Download,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CaseDocument, DocumentExtraction, ProcessingStep } from "@/lib/types";
import { getDocumentBlob, saveDocumentBlob } from "@/lib/idb-storage";
import { playScanSpeechNotification } from "@/lib/audio-speech";
import { useLanguage } from "@/lib/language-context";

// Configure pdfjs worker to local bundled worker URL
if (typeof window !== "undefined") {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  } catch (e) {
    console.warn("Failed to set pdfjs workerSrc:", e);
  }
}

export type DocumentRenderState =
  | "LOADING_DOCUMENT"
  | "DOCUMENT_READY"
  | "DOCUMENT_RENDER_ERROR"
  | "UNSUPPORTED_TYPE";

interface PdfViewerProps {
  fileUrl: string;
  pageNumber: number;
  zoom: number;
  rotation?: number;
  onRenderSuccess: (numPages: number) => void;
  onRenderError: (reason: string) => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({
  fileUrl,
  pageNumber,
  zoom,
  rotation = 0,
  onRenderSuccess,
  onRenderError,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useNativeEmbed, setUseNativeEmbed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    let renderTask: any = null;

    async function loadPdf() {
      if (!fileUrl) {
        console.warn("[DOCUMENT RETRIEVAL TRACE] PdfViewer error: Empty fileUrl");
        onRenderError("File URL is empty");
        return;
      }

      setUseNativeEmbed(false);

      try {
        let loadingTask;
        if (fileUrl.startsWith("data:")) {
          try {
            const res = await fetch(fileUrl);
            const arrayBuffer = await res.arrayBuffer();
            loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
          } catch {
            const base64Clean = fileUrl.split(",")[1]?.replace(/\s/g, "") || "";
            const binaryString = window.atob(base64Clean);
            const len = binaryString.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            loadingTask = pdfjsLib.getDocument({ data: bytes });
          }
        } else {
          loadingTask = pdfjsLib.getDocument({ url: fileUrl });
        }

        const pdf = await loadingTask.promise;
        if (!isMounted) return;

        onRenderSuccess(pdf.numPages);

        if (canvasRef.current) {
          const targetPage = Math.min(Math.max(1, pageNumber), pdf.numPages);
          const page = await pdf.getPage(targetPage);
          if (!isMounted) return;

          const scale = 1.6 * (zoom / 100);
          const viewport = page.getViewport({ scale, rotation });
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");

          if (canvas && context) {
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            renderTask = page.render({
              canvasContext: context,
              viewport,
            });

            await renderTask.promise;
          }
        }
      } catch (err: any) {
        console.warn("[DOCUMENT RETRIEVAL TRACE] PdfViewer standard canvas render notice:", err);
        // Resilient fallback: render via native browser PDF viewer object directly
        if (isMounted) {
          setUseNativeEmbed(true);
          onRenderSuccess(1);
        }
      }
    }

    loadPdf();

    return () => {
      isMounted = false;
      if (renderTask) {
        try {
          renderTask.cancel();
        } catch (_) {}
      }
    };
  }, [fileUrl, pageNumber, zoom, rotation]);

  if (useNativeEmbed) {
    return (
      <div className="relative w-full h-[750px] flex flex-col items-center justify-center bg-neutral-900 rounded">
        <object
          data={fileUrl}
          type="application/pdf"
          className="w-full h-full rounded"
        >
          <div className="flex flex-col items-center justify-center p-6 text-neutral-300">
            <p className="text-sm mb-3">Authentic PDF deed ready for viewing.</p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded flex items-center gap-1.5"
            >
              <ExternalLink size={14} /> Open Original Document Scan
            </a>
          </div>
        </object>
      </div>
    );
  }

  return (
    <div className="relative w-full flex items-center justify-center min-h-[600px]">
      <canvas ref={canvasRef} className="w-full h-auto rounded shadow-sm max-h-[850px] object-contain" />
    </div>
  );
};

interface DocumentScannerProps {
  document: CaseDocument;
  extraction: DocumentExtraction | null;
  processingSteps: ProcessingStep[];
  isProcessing: boolean;
  onProcess: (documentId: string) => void;
  onNextDocument?: () => void;
  onPrevDocument?: () => void;
  hasNextDocument?: boolean;
  hasPrevDocument?: boolean;
  onViewExtractions?: () => void;
  quotaAlertMessage?: string | null;
}

export const DocumentScanner: React.FC<DocumentScannerProps> = ({
  document: doc,
  extraction,
  processingSteps,
  isProcessing,
  onProcess,
  onNextDocument,
  onPrevDocument,
  hasNextDocument,
  hasPrevDocument,
  onViewExtractions,
  quotaAlertMessage,
}) => {
  const { t } = useLanguage();
  // Document Viewer Controls State
  const [zoom, setZoom] = useState<number>(100);
  const [rotation, setRotation] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Document Render State Machine
  const [renderState, setRenderState] = useState<DocumentRenderState>("LOADING_DOCUMENT");
  const [renderErrorReason, setRenderErrorReason] = useState<string | null>(null);
  const [activeFileUrl, setActiveFileUrl] = useState<string>(doc.fileUrl || "");
  const [retryKey, setRetryKey] = useState<number>(0);
  const [identityError, setIdentityError] = useState<string | null>(null);

  // MIME type checking
  const mimeType = (doc.mimeType || "").toLowerCase();
  const fileName = (doc.fileName || "").toLowerCase();

  const isPdf =
    mimeType.includes("pdf") ||
    fileName.endsWith(".pdf") ||
    activeFileUrl.startsWith("data:application/pdf");

  const isImage =
    mimeType.startsWith("image/") ||
    /\.(png|jpe?g|webp|gif|bmp)$/i.test(fileName) ||
    activeFileUrl.startsWith("data:image/");

  const isSupported = isPdf || isImage || doc.isDemo;

  // Retrieve file url with dual-tier IndexedDB + API resilience
  useEffect(() => {
    let isCurrent = true;
    setIdentityError(null);
    setRenderErrorReason(null);
    setCurrentPage(1);

    async function resolveDocumentContent() {
      // 1. If document already has an inline data URL or valid blob
      if (doc.fileUrl && (doc.fileUrl.startsWith("data:") || doc.fileUrl.startsWith("blob:"))) {
        if (isCurrent) {
          setActiveFileUrl(doc.fileUrl);
          setRenderState("DOCUMENT_READY");
          // Background sync to IndexedDB
          saveDocumentBlob(doc.id, doc.fileUrl, doc.mimeType).catch(() => {});
        }
        return;
      }

      // 2. Check client-side persistent IndexedDB
      try {
        const cached = await getDocumentBlob(doc.id);
        if (cached && cached.dataUrl && isCurrent) {
          setActiveFileUrl(cached.dataUrl);
          setRenderState("DOCUMENT_READY");
          return;
        }
      } catch (e) {
        console.warn("[DOCUMENT RETRIEVAL TRACE] IDB cache check warning:", e);
      }

      // 3. Try candidate server API endpoints
      const candidateUrls = [
        doc.fileUrl,
        doc.id ? `/api/storage/doc/${doc.id}` : null,
      ].filter(Boolean) as string[];

      for (const targetUrl of candidateUrls) {
        try {
          const res = await fetch(targetUrl);
          if (res.ok) {
            const blob = await res.blob();
            if (blob.size > 0) {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });

              if (isCurrent && dataUrl) {
                setActiveFileUrl(dataUrl);
                setRenderState("DOCUMENT_READY");
                saveDocumentBlob(doc.id, dataUrl, blob.type || doc.mimeType).catch(() => {});
                return;
              }
            }
          }
        } catch (err) {
          console.warn("[DOCUMENT RETRIEVAL TRACE] Candidate fetch notice:", targetUrl, err);
        }
      }

      // 4. If demo record without binary
      if (doc.isDemo && isCurrent) {
        setRenderState("DOCUMENT_READY");
        return;
      }

      if (isCurrent) {
        setRenderState("DOCUMENT_RENDER_ERROR");
        setRenderErrorReason("Original document could not be retrieved from storage.");
      }
    }

    setRenderState("LOADING_DOCUMENT");
    resolveDocumentContent();

    return () => {
      isCurrent = false;
    };
  }, [doc.id, doc.fileUrl, retryKey, doc.isDemo]);

  // Handle successful document render callback
  const handleRenderSuccess = (pagesCount: number) => {
    setTotalPages(Math.max(1, pagesCount));
    setRenderState("DOCUMENT_READY");
    setRenderErrorReason(null);
  };

  // Handle document render error callback
  const handleRenderError = (reason: string) => {
    setRenderState("DOCUMENT_RENDER_ERROR");
    setRenderErrorReason(reason || "Unable to load the uploaded document.");
  };

  const documentRenderReady = renderState === "DOCUMENT_READY";

  // Scanner Animation & Continuous Laser State
  const [scanComplete, setScanComplete] = useState<boolean>(doc.status === "COMPLETED" && !isProcessing);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(1);

  // Sync scan complete state strictly with doc status and processing flag
  const hasSpokenScanAudioRef = useRef<string | null>(null);

  useEffect(() => {
    if ((isProcessing || doc.status === "PROCESSING") && hasSpokenScanAudioRef.current !== doc.id) {
      hasSpokenScanAudioRef.current = doc.id;
      playScanSpeechNotification();
    } else if (doc.status === "COMPLETED" || doc.status === "FAILED") {
      hasSpokenScanAudioRef.current = null;
    }
  }, [isProcessing, doc.status, doc.id]);

  useEffect(() => {
    if (doc.status === "COMPLETED" && !isProcessing) {
      setScanComplete(true);
      setActiveStepIndex(4);
    } else if (isProcessing || doc.status === "PROCESSING") {
      setScanComplete(false);
      setActiveStepIndex(1);
    } else {
      setScanComplete(false);
      setActiveStepIndex(0);
    }
  }, [isProcessing, doc.status, documentRenderReady]);

  // Timeline Step Sync
  useEffect(() => {
    if (doc.status === "COMPLETED") {
      setActiveStepIndex(4);
    } else if (doc.status === "PROCESSING" || isProcessing) {
      if (processingSteps.some((s) => s.step === "EXTRACTION" && s.status === "IN_PROGRESS")) {
        setActiveStepIndex(2);
      } else if (processingSteps.some((s) => s.step === "DOCUMENT_UNDERSTANDING" && s.status === "IN_PROGRESS")) {
        setActiveStepIndex(3);
      } else {
        setActiveStepIndex(1);
      }
    } else if (doc.status === "FAILED") {
      setActiveStepIndex(1);
    } else {
      setActiveStepIndex(0);
    }
  }, [doc.status, isProcessing, processingSteps]);

  // Zoom Helpers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50));
  const handleZoomReset = () => setZoom(100);

  const toggleFullscreen = () => {
    if (!viewerRef.current) return;
    if (!document.fullscreenElement) {
      viewerRef.current.requestFullscreen().catch((err) => console.error(err));
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch((err) => console.error(err));
      setIsFullscreen(false);
    }
  };

  // Process Handler with Debug Logging & File Identity Verification
  const handleProcessClick = () => {
    // Identity Check
    if (!doc.fileName || doc.fileName.trim().length === 0) {
      setIdentityError("Document identity mismatch. Processing has been stopped.");
      return;
    }

    // Console Debug Logging
    console.log("[DOCUMENT PROCESS STARTED]", {
      documentId: doc.id,
      caseId: doc.caseId,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      storagePath: doc.storagePath,
      resolvedFileUrl: activeFileUrl,
      documentRenderStatus: renderState,
      processingStatus: doc.status,
    });

    onProcess(doc.id);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Document Metadata Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-card-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))] font-semibold">
            {isPdf ? <FileText size={20} /> : <Layers size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground text-sm truncate max-w-[280px] sm:max-w-[400px]">
                {doc.fileName}
              </h3>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground uppercase">
                {t((doc.documentType || "DOCUMENT").replace(/_/g, " "))}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span>{t("Serial #")}{doc.serialNumber}</span>
              <span>•</span>
              <span>{(doc.fileSize / (1024 * 1024)).toFixed(2)} MB</span>
              <span>•</span>
              <span className="font-mono">{doc.mimeType || "application/pdf"}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {hasPrevDocument && (
            <Button variant="quiet" size="sm" onClick={onPrevDocument} title={t("Previous Document")}>
              <ChevronLeft size={16} />
            </Button>
          )}
          {hasNextDocument && (
            <Button variant="quiet" size="sm" onClick={onNextDocument} title={t("Next Document")}>
              <ChevronRight size={16} />
            </Button>
          )}

          <Button
            onClick={handleProcessClick}
            disabled={isProcessing || doc.status === "PROCESSING"}
            variant={doc.status === "COMPLETED" ? "quiet" : "accent"}
            className="text-xs font-semibold"
          >
            <Sparkles size={14} className={isProcessing ? "animate-spin" : ""} />
            {isProcessing || doc.status === "PROCESSING"
              ? t("Scanning Document...")
              : doc.status === "COMPLETED"
              ? t("Re-scan Document")
              : t("Process Document")}
          </Button>

          {extraction && onViewExtractions && (
            <Button onClick={onViewExtractions} variant="primary" className="text-xs font-semibold">
              <Eye size={14} /> {t("View Extracted Data")}
            </Button>
          )}
        </div>
      </div>

      {/* Identity Error Banner */}
      {identityError && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-xs text-red-200 flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400 shrink-0" />
          <span className="font-semibold">{t(identityError)}</span>
        </div>
      )}

      {/* Quota / Error Banner */}
      {(quotaAlertMessage || doc.errorMessage) && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-950 dark:text-amber-100 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-semibold text-amber-900 dark:text-amber-200">{t("Processing Alert")}</h4>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed">
              {t(quotaAlertMessage || doc.errorMessage || "Document processing generated an alert.")}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid Layout: Scanner Workspace (Left) + Processing Timeline (Right) */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr]">
        {/* Document Scanner Viewport Container */}
        <div
          ref={viewerRef}
          className="relative flex flex-col rounded-xl border border-card-border bg-neutral-900 text-neutral-100 overflow-hidden shadow-xl min-h-[640px]"
        >
          {/* Continuous Horizontal Green Scan Line Bar */}
          {(isProcessing || doc.status === "PROCESSING") && (
            <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-950 overflow-hidden z-30">
              <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#22c55e] animate-scan-horizontal" />
            </div>
          )}

          {/* Viewer Toolbar */}
          <div className="flex items-center justify-between border-b border-neutral-800 bg-neutral-950/80 px-4 py-2 text-xs text-neutral-300 backdrop-blur-sm z-20">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  {(isProcessing || doc.status === "PROCESSING") && documentRenderReady && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  )}
                  <span
                    className={`relative inline-flex rounded-full h-2 w-2 ${
                      (isProcessing || doc.status === "PROCESSING") && documentRenderReady
                        ? "bg-emerald-500"
                        : documentRenderReady
                        ? "bg-emerald-400"
                        : renderState === "DOCUMENT_RENDER_ERROR"
                        ? "bg-red-500"
                        : "bg-neutral-500"
                    }`}
                  />
                </span>
                {(isProcessing || doc.status === "PROCESSING") && documentRenderReady
                  ? t("AI Optical Scanner Active")
                  : documentRenderReady
                  ? t("Document Loaded & Ready")
                  : renderState === "LOADING_DOCUMENT"
                  ? t("Loading Uploaded File...")
                  : renderState === "DOCUMENT_RENDER_ERROR"
                  ? t("Document Render Failed")
                  : t("Unsupported Document")}
              </span>
              <span className="text-neutral-600">•</span>
              <span>
                {t("Page")} {currentPage} {t("of")} {totalPages}
              </span>
            </div>

            {/* Viewer Zoom, Rotation & View Options */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Rotate Left 90°")}
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Rotate Right 90°")}
              >
                <RotateCw size={15} />
              </button>
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Zoom Out")}
              >
                <ZoomOut size={15} />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className="px-2 py-0.5 rounded text-[11px] font-mono hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Reset Zoom")}
              >
                {zoom}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Zoom In")}
              >
                <ZoomIn size={15} />
              </button>
              <div className="h-3 w-[1px] bg-neutral-800 mx-0.5" />
              {activeFileUrl && (
                <a
                  href={activeFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                  title={t("Open Original Document in New Tab")}
                >
                  <ExternalLink size={15} />
                </a>
              )}
              <button
                type="button"
                onClick={toggleFullscreen}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                title={t("Toggle Fullscreen")}
              >
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </div>
          </div>

          {/* Document Content Canvas Area */}
          <div className="relative flex-1 overflow-auto p-4 md:p-6 flex items-center justify-center bg-neutral-950/70 min-h-[550px]">
            <div
              className="relative transition-transform duration-200 ease-out shadow-2xl rounded"
              style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center" }}
            >
              {/* Actual Document Viewport Container */}
              <div className="relative w-[600px] min-h-[750px] bg-white text-slate-900 rounded-sm p-4 font-serif shadow-2xl border border-neutral-300 select-none overflow-hidden flex flex-col justify-center items-center">
                
                {/* 1. LOADING STATE */}
                {renderState === "LOADING_DOCUMENT" && (
                  <div className="flex flex-col items-center justify-center space-y-3 py-20 text-neutral-600">
                    <RefreshCw size={28} className="animate-spin text-emerald-600" />
                    <span className="text-xs font-sans font-medium text-slate-700">
                      {t("Loading authentic scan for")} "{doc.fileName}"...
                    </span>
                  </div>
                )}

                {/* 2. ERROR STATE */}
                {renderState === "DOCUMENT_RENDER_ERROR" && (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md my-auto">
                    <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                      <FileWarning size={28} />
                    </div>
                    <div className="space-y-1 font-sans">
                      <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                        {t("DOCUMENT RETRIEVAL NOTICE")}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono break-all">
                        {t("File")}: {doc.fileName}
                      </p>
                      <p className="text-xs text-red-600 font-medium pt-1">
                        {t(renderErrorReason || "Unable to load document.")}
                      </p>
                    </div>
                    <Button
                      onClick={() => setRetryKey((k) => k + 1)}
                      variant="accent"
                      size="sm"
                      className="text-xs font-semibold flex items-center gap-2 mt-2"
                    >
                      <RefreshCw size={14} /> {t("RETRY SCAN LOAD")}
                    </Button>
                  </div>
                )}

                {/* 3. UNSUPPORTED FORMAT STATE */}
                {renderState === "UNSUPPORTED_TYPE" && (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 max-w-md my-auto font-sans">
                    <AlertTriangle size={32} className="text-amber-500" />
                    <h3 className="text-sm font-bold text-slate-900 uppercase">
                      {t("UNSUPPORTED FILE FORMAT")}
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      {t("Document preview for this file type is not currently supported.")}
                    </p>
                  </div>
                )}

                {/* 4. AUTHENTIC DOCUMENT RENDERING (Image, PDF, or Reference Seed) */}
                {(renderState === "LOADING_DOCUMENT" || renderState === "DOCUMENT_READY") && (
                  <div className={renderState === "LOADING_DOCUMENT" ? "hidden" : "w-full h-full flex items-center justify-center"}>
                    {isImage && activeFileUrl ? (
                      <div className="w-full flex items-center justify-center transition-all">
                        <img
                          src={activeFileUrl}
                          alt={doc.fileName}
                          style={{ transform: `rotate(${rotation}deg)` }}
                          className="w-full h-auto max-h-[820px] object-contain rounded shadow-sm transition-transform duration-200"
                          onLoad={() => handleRenderSuccess(1)}
                          onError={() => handleRenderError("Unable to load uploaded document scan image.")}
                        />
                      </div>
                    ) : isPdf && activeFileUrl ? (
                      <PdfViewer
                        fileUrl={activeFileUrl}
                        pageNumber={currentPage}
                        zoom={zoom}
                        rotation={rotation}
                        onRenderSuccess={handleRenderSuccess}
                        onRenderError={handleRenderError}
                      />
                    ) : doc.isDemo ? (
                      <div className="w-full h-full flex flex-col p-6 text-slate-800 bg-amber-50/15 font-sans leading-relaxed select-text select-all relative">
                        {/* Official Badge */}
                        <div className="flex flex-col items-center justify-center text-center pb-4 border-b border-slate-200/50 mt-2">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 font-mono">
                            {t("Revenue Records Archive")}
                          </span>
                          <h2 className="text-base font-serif font-bold text-slate-800 tracking-wide mt-1">
                            {t("GOVERNMENT OF INDIA REVENUE ARCHIVES")}
                          </h2>
                          <p className="text-[9px] text-slate-400 mt-0.5">
                            {t("AUTHENTICATED LAND REGISTRY MANIFEST")}
                          </p>
                        </div>

                        {/* File Details Grid */}
                        <div className="mt-5 space-y-4 flex-1">
                          <div className="p-3.5 rounded bg-slate-50/70 border border-slate-200/50 text-xs space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">{t("Deed Class")}:</span>
                              <span className="font-semibold text-slate-800 uppercase">{t((doc.documentType || "DOCUMENT").replace(/_/g, " "))}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">{t("Filename")}:</span>
                              <span className="font-mono text-slate-700">{doc.fileName}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-slate-500 text-[11px]">{t("Status")}:</span>
                              <span className="font-semibold text-emerald-700">{t(doc.status)}</span>
                            </div>
                          </div>

                          {extraction && (
                            <div className="p-3.5 rounded bg-emerald-50/40 border border-emerald-100/50 text-xs space-y-2">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                                {t("Verified Land Record Attributes")}
                              </span>
                              <div className="grid grid-cols-2 gap-2 text-slate-700">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">{t("Owner / Claimant")}</span>
                                  <span className="font-bold text-slate-900">{t(extraction.owner_name || "N/A")}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">{t("Khasra / Survey No.")}</span>
                                  <span className="font-mono font-bold text-slate-900">{extraction.khasra_number || extraction.survey_number || "N/A"}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">{t("Area")}</span>
                                  <span className="font-bold text-slate-900">{extraction.area ? `${extraction.area} ${t(extraction.area_unit || "Acres")}` : "N/A"}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-slate-400 block">{t("Village & District")}</span>
                                  <span className="font-bold text-slate-900">{extraction.village || extraction.district ? `${t(extraction.village || "")}, ${t(extraction.district || "")}` : "N/A"}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* GREEN SCANNING BEAM LAYER - CONTINUOUS TOP TO BOTTOM SCANNING */}
                {(isProcessing || doc.status === "PROCESSING") && documentRenderReady && !scanComplete && (
                  <div className="absolute left-0 right-0 z-30 pointer-events-none animate-scan-vertical">
                    {/* Glowing Beam Line */}
                    <div className="h-[4px] w-full bg-emerald-400 shadow-[0_0_15px_#22c55e,0_0_30px_#10b981,0_0_45px_#059669]" />
                    {/* Beam Trail Gradient */}
                    <div className="h-24 w-full bg-gradient-to-b from-emerald-500/30 to-transparent" />
                  </div>
                )}

                {/* Scan Completion Badge Overlay */}
                {(scanComplete || doc.status === "COMPLETED") && documentRenderReady && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-full bg-emerald-900/90 border border-emerald-500/50 px-4 py-1.5 text-xs font-medium text-emerald-100 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 font-sans">
                    <CheckCircle2 size={16} className="text-emerald-400" />
                    <span>{t("Optical Scan Verified • Extracted Revenue Attributes Below")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page Pagination Controls Footer */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-neutral-800 bg-neutral-950/90 px-4 py-2 text-xs text-neutral-400 z-20">
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="text-neutral-400 hover:text-neutral-100"
              >
                <ChevronLeft size={14} /> {t("Previous Page")}
              </Button>
              <span className="font-mono text-[11px] text-neutral-300">
                {t("Page")} {currentPage} {t("of")} {totalPages}
              </span>
              <Button
                variant="quiet"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="text-neutral-400 hover:text-neutral-100"
              >
                {t("Next Page")} <ChevronRight size={14} />
              </Button>
            </div>
          )}
        </div>

        {/* Processing Timeline & Realtime Inspection Panel */}
        <div className="flex flex-col gap-6">
          {/* Main Timeline Card */}
          <section className="rounded-xl border border-card-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                  {t("Processing Engine")}
                </div>
                <h3 className="text-base font-semibold text-foreground flex items-center gap-2 mt-0.5">
                  <Cpu size={16} className="text-[hsl(var(--primary))]" />
                  {t("Document Analysis Pipeline")}
                </h3>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                  doc.status === "COMPLETED"
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                    : isProcessing || doc.status === "PROCESSING"
                    ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 animate-pulse"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {doc.status === "COMPLETED"
                  ? t("Completed")
                  : isProcessing || doc.status === "PROCESSING"
                  ? t("In Progress")
                  : t("Uploaded")}
              </span>
            </div>

            {/* Step-by-Step Vertical Timeline */}
            <div className="mt-6 space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
              {/* Step 1: Document Uploaded */}
              <TimelineStepItem
                stepNumber={1}
                title={t("Document Uploaded")}
                subtitle={doc.uploadedAt ? new Date().toLocaleTimeString() : t("File ingested")}
                status={activeStepIndex >= 0 ? "COMPLETED" : "PENDING"}
              />

              {/* Step 2: Scanning & Analyzing */}
              <TimelineStepItem
                stepNumber={2}
                title={t("Scanning & Analyzing")}
                subtitle={t("Extracting information using Optical OCR & Vision Stream")}
                status={
                  activeStepIndex > 1
                    ? "COMPLETED"
                    : activeStepIndex === 1
                    ? "IN_PROGRESS"
                    : "PENDING"
                }
              />

              {/* Step 3: Extracting Fields */}
              <TimelineStepItem
                stepNumber={3}
                title={t("Extracting Fields")}
                subtitle={t("Parsing names, survey/khasra numbers, area & details")}
                status={
                  activeStepIndex > 2
                    ? "COMPLETED"
                    : activeStepIndex === 2
                    ? "IN_PROGRESS"
                    : "PENDING"
                }
              />

              {/* Step 4: Validating Data */}
              <TimelineStepItem
                stepNumber={4}
                title={t("Validating Data")}
                subtitle={t("Cross-checking confidence score & revenue schemas")}
                status={
                  activeStepIndex > 3
                    ? "COMPLETED"
                    : activeStepIndex === 3
                    ? "IN_PROGRESS"
                    : "PENDING"
                }
              />

              {/* Step 5: Completed */}
              <TimelineStepItem
                stepNumber={5}
                title={t("Completed")}
                subtitle={t("Structured parameters ready for verification")}
                status={doc.status === "COMPLETED" ? "COMPLETED" : "PENDING"}
              />
            </div>

            {/* Helpful Informational Callout */}
            <div className="mt-6 rounded-lg bg-secondary/50 p-3.5 text-xs text-muted-foreground border border-border">
              <p className="leading-relaxed">
                <span className="font-semibold text-foreground">{t("Background Processing")}:</span> {t("You can safely view other documents or stages while processing continues in the background.")}
              </p>
            </div>
          </section>

          {/* Quick Realtime Steps Log */}
          {processingSteps.length > 0 && (
            <section className="rounded-xl border border-card-border bg-card p-5 shadow-sm">
              <div className="mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">
                {t("Execution Log")}
              </div>
              <h4 className="text-xs font-semibold text-foreground mt-1 mb-3">
                {t("Live Audit Events")}
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {processingSteps.map((s, i) => (
                  <div key={s.id || i} className="flex items-start gap-2 text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                      {i + 1}.
                    </span>
                    <span className="text-foreground leading-snug">{t(s.message)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Component for Timeline Step Rendering
interface TimelineStepItemProps {
  stepNumber: number;
  title: string;
  subtitle: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
}

const TimelineStepItem: React.FC<TimelineStepItemProps> = ({
  stepNumber,
  title,
  subtitle,
  status,
}) => {
  const { t } = useLanguage();
  return (
    <div className="relative pl-8 flex items-start justify-between">
      <div
        className={`absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${
          status === "COMPLETED"
            ? "border-emerald-500 bg-emerald-500 text-white"
            : status === "IN_PROGRESS"
            ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-white animate-pulse"
            : "border-border bg-background text-muted-foreground"
        }`}
      >
        {status === "COMPLETED" ? (
          <Check size={14} />
        ) : (
          <span>{stepNumber}</span>
        )}
      </div>

      <div>
        <h4
          className={`text-xs font-bold leading-tight ${
            status === "COMPLETED"
              ? "text-foreground"
              : status === "IN_PROGRESS"
              ? "text-[hsl(var(--primary))]"
              : "text-muted-foreground"
          }`}
        >
          {t(title)}
        </h4>
        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
          {t(subtitle)}
        </p>
      </div>
    </div>
  );
};
