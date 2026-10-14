import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { privateStorage } from "../lib/storage";
import { requireAuth } from "../middlewares/auth";
import { randomUUID } from "node:crypto";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const router: IRouter = Router();

router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.size > MAX_FILE_SIZE) {
    res.status(400).json({ error: "File too large. Maximum size is 50 MB." });
    return;
  }
  const result = await privateStorage.createUpload();
  res.json(RequestUploadUrlResponse.parse(result));
});

// Direct fast upload endpoint for documents
router.post("/storage/upload-direct", async (req: Request, res: Response): Promise<void> => {
  try {
    const { fileName, fileData, mimeType, caseId, documentId } = req.body;
    const objectId = randomUUID();
    const objectPath = `/objects/uploads/${objectId}`;
    
    let buffer: Buffer;
    if (fileData && typeof fileData === "string" && fileData.includes(";base64,")) {
      const base64Data = fileData.split(";base64,")[1];
      buffer = Buffer.from(base64Data, "base64");
    } else if (fileData && typeof fileData === "string") {
      buffer = Buffer.from(fileData, "base64");
    } else {
      buffer = Buffer.from(fileName || "land-record-document");
    }

    console.log("[DOCUMENT RETRIEVAL TRACE] Direct Upload Received:", {
      fileName,
      mimeType: mimeType || "application/pdf",
      caseId,
      documentId,
      objectId,
      bufferSizeBytes: buffer.length,
      storagePath: objectPath,
    });

    await privateStorage.saveFile(objectPath, buffer, mimeType || "application/pdf", "dev-officer-land-records");
    if (documentId) {
      await privateStorage.saveFile(`doc:${documentId}`, buffer, mimeType || "application/pdf", "dev-officer-land-records");
    }
    
    console.log("[DOCUMENT RETRIEVAL TRACE] Direct Upload Saved Successfully to Storage:", {
      objectId,
      fileUrl: `/api/storage/file/${objectId}`,
    });

    res.json({
      success: true,
      objectId,
      storagePath: objectPath,
      fileUrl: `/api/storage/file/${objectId}`,
      fileName,
    });
  } catch (err: any) {
    console.error("[DOCUMENT RETRIEVAL TRACE] Direct upload error:", err);
    res.status(500).json({ error: err?.message || "Direct upload failed" });
  }
});

router.put("/storage/uploads/direct/:objectId", async (req: Request, res: Response): Promise<void> => {
  const objectPath = `/objects/uploads/${req.params.objectId}`;
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", async () => {
    const buffer = Buffer.concat(chunks);
    const mimeType = (req.headers["content-type"] as string) || "application/pdf";
    console.log("[DOCUMENT RETRIEVAL TRACE] Stream upload completed:", { objectPath, size: buffer.length, mimeType });
    await privateStorage.saveFile(objectPath, buffer, mimeType);
    res.sendStatus(200);
  });
  req.on("error", (err) => {
    console.error("[DOCUMENT RETRIEVAL TRACE] Stream upload error:", err);
    res.sendStatus(500);
  });
});

// Serve uploaded file content directly by objectId
router.get("/storage/file/:objectId", async (req: Request, res: Response): Promise<void> => {
  try {
    const objectPath = `/objects/uploads/${req.params.objectId}`;
    const fileObj = privateStorage.getFile(objectPath);
    if (!fileObj) {
      console.warn("[DOCUMENT RETRIEVAL TRACE] File not found by objectId:", req.params.objectId);
      res.status(404).json({ error: "File not found in storage" });
      return;
    }
    
    console.log("[DOCUMENT RETRIEVAL TRACE] Served file successfully by objectId:", {
      objectId: req.params.objectId,
      contentType: fileObj.mimeType,
      bufferSizeBytes: fileObj.buffer.length,
    });

    res.setHeader("Content-Type", fileObj.mimeType);
    res.setHeader("Content-Length", fileObj.buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(fileObj.buffer);
  } catch (err) {
    console.warn("[DOCUMENT RETRIEVAL TRACE] Exception serving file by objectId:", req.params.objectId, err);
    res.status(404).send("File not found");
  }
});

// Serve uploaded file content directly by documentId
router.get("/storage/doc/:documentId", async (req: Request, res: Response): Promise<void> => {
  try {
    const docId = req.params.documentId;
    let fileObj = privateStorage.getFile(`doc:${docId}`) || privateStorage.getFile(docId);
    
    if (!fileObj) {
      console.warn("[DOCUMENT RETRIEVAL TRACE] File not found by documentId:", docId);
      res.status(404).json({ error: "Document binary not found in storage" });
      return;
    }

    console.log("[DOCUMENT RETRIEVAL TRACE] Served file successfully by documentId:", {
      documentId: docId,
      contentType: fileObj.mimeType,
      bufferSizeBytes: fileObj.buffer.length,
    });

    res.setHeader("Content-Type", fileObj.mimeType);
    res.setHeader("Content-Length", fileObj.buffer.length);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(fileObj.buffer);
  } catch (err) {
    console.warn("[DOCUMENT RETRIEVAL TRACE] Exception serving file by documentId:", req.params.documentId, err);
    res.status(404).send("File not found");
  }
});

router.get("/storage/uploads/direct/:objectId", async (req: Request, res: Response): Promise<void> => {
  try {
    const objectPath = `/objects/uploads/${req.params.objectId}`;
    const fileResponse = await privateStorage.download(objectPath);
    const arrayBuffer = await fileResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    res.setHeader("Content-Type", fileResponse.headers.get("Content-Type") || "application/pdf");
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(404).send("File not found");
  }
});

export default router;