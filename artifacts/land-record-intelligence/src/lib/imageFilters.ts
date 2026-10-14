import { jsPDF } from "jspdf";

export type FilterMode = "original" | "magic_color" | "bw";

export interface ProcessedImageResult {
  dataUrl: string;
  blob: Blob;
  sizeKb: number;
  width: number;
  height: number;
}

/**
 * Applies document image enhancements (Magic Color, Crisp B&W, Original)
 * and manual 90-degree rotations onto a canvas.
 */
export function applyImageFilter(
  sourceCanvas: HTMLCanvasElement,
  filterMode: FilterMode = "original",
  rotationDegrees: number = 0
): HTMLCanvasElement {
  const normRotation = ((rotationDegrees % 360) + 360) % 360;
  const isRotated90 = normRotation === 90 || normRotation === 270;

  const srcWidth = sourceCanvas.width;
  const srcHeight = sourceCanvas.height;

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = isRotated90 ? srcHeight : srcWidth;
  targetCanvas.height = isRotated90 ? srcWidth : srcHeight;

  const ctx = targetCanvas.getContext("2d");
  if (!ctx) return sourceCanvas;

  ctx.save();
  ctx.translate(targetCanvas.width / 2, targetCanvas.height / 2);
  ctx.rotate((normRotation * Math.PI) / 180);
  ctx.drawImage(sourceCanvas, -srcWidth / 2, -srcHeight / 2);
  ctx.restore();

  if (filterMode === "original") {
    return targetCanvas;
  }

  const imgData = ctx.getImageData(0, 0, targetCanvas.width, targetCanvas.height);
  const data = imgData.data;
  const len = data.length;

  if (filterMode === "magic_color") {
    // Magic Color: Enhance paper brightness & boost text contrast
    for (let i = 0; i < len; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      // Contrast boost (factor 1.25)
      r = Math.min(255, Math.max(0, (r - 128) * 1.25 + 128));
      g = Math.min(255, Math.max(0, (g - 128) * 1.25 + 128));
      b = Math.min(255, Math.max(0, (b - 128) * 1.25 + 128));

      // Brightness boost for paper background
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luminance > 180) {
        // Brighten background paper towards crisp white
        r = Math.min(255, r * 1.1 + 15);
        g = Math.min(255, g * 1.1 + 15);
        b = Math.min(255, b * 1.1 + 15);
      } else {
        // Darken text inks for crisp legibility
        r = r * 0.9;
        g = g * 0.9;
        b = b * 0.9;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }
  } else if (filterMode === "bw") {
    // Crisp B&W: Adaptive thresholding / Grayscale
    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // NTSC Grayscale conversion
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      // Crisp document thresholding (threshold ~ 140)
      const v = gray > 140 ? 255 : Math.max(0, gray * 0.65);

      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return targetCanvas;
}

/**
 * Rescales canvas to max 1600px dimension and outputs high-quality JPEG
 * (< 500 KB per page)
 */
export function compressCanvasToJpeg(
  sourceCanvas: HTMLCanvasElement,
  maxDimension = 1600,
  quality = 0.75
): Promise<ProcessedImageResult> {
  return new Promise((resolve) => {
    let width = sourceCanvas.width;
    let height = sourceCanvas.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const scaledCanvas = document.createElement("canvas");
    scaledCanvas.width = width;
    scaledCanvas.height = height;

    const ctx = scaledCanvas.getContext("2d");
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(sourceCanvas, 0, 0, width, height);
    }

    scaledCanvas.toBlob(
      (blob) => {
        if (!blob) {
          const fallbackDataUrl = scaledCanvas.toDataURL("image/jpeg", quality);
          resolve({
            dataUrl: fallbackDataUrl,
            blob: new Blob([], { type: "image/jpeg" }),
            sizeKb: Math.round(fallbackDataUrl.length / 1024),
            width,
            height
          });
          return;
        }

        const dataUrl = scaledCanvas.toDataURL("image/jpeg", quality);
        resolve({
          dataUrl,
          blob,
          sizeKb: Math.round(blob.size / 1024),
          width,
          height
        });
      },
      "image/jpeg",
      quality
    );
  });
}

/**
 * Compiles an array of page image data URLs into a multi-page client-side PDF using jsPDF
 */
export async function generateCompiledPdf(
  pages: { dataUrl: string; width?: number; height?: number }[],
  documentTitle = "Scanned_Land_Deed"
): Promise<Blob> {
  if (pages.length === 0) {
    return new Blob([], { type: "application/pdf" });
  }

  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 210 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

  for (let i = 0; i < pages.length; i++) {
    if (i > 0) {
      pdf.addPage("a4", "portrait");
    }

    const page = pages[i];
    const imgProps = pdf.getImageProperties(page.dataUrl);
    const imgWidth = imgProps.width;
    const imgHeight = imgProps.height;

    // Fit image inside A4 margins with preserved aspect ratio
    const ratio = Math.min(pageWidth / imgWidth, pageHeight / imgHeight);
    const renderWidth = imgWidth * ratio;
    const renderHeight = imgHeight * ratio;
    const xOffset = (pageWidth - renderWidth) / 2;
    const yOffset = (pageHeight - renderHeight) / 2;

    pdf.addImage(
      page.dataUrl,
      "JPEG",
      xOffset,
      yOffset,
      renderWidth,
      renderHeight,
      `PAGE_${i}`,
      "FAST"
    );

    // Footer page numbering
    pdf.setFontSize(9);
    pdf.setTextColor(100, 116, 139);
    pdf.text(
      `${documentTitle} • Page ${i + 1} of ${pages.length}`,
      pageWidth / 2,
      pageHeight - 6,
      { align: "center" }
    );
  }

  const pdfOutput = pdf.output("blob");
  return pdfOutput;
}
