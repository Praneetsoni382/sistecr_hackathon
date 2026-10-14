import { randomUUID } from "node:crypto";
import { desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCaseDocumentBody,
  CreateCaseDocumentParams,
  CreateCaseDocumentResponse,
  DeleteDocumentParams,
  ListCaseDocumentsParams,
  ListCaseDocumentsResponse,
} from "@workspace/api-zod";
import { db, casesTable, documentsTable } from "@workspace/db";
import { currentUserId, requireAuth } from "../middlewares/auth";
import { privateStorage } from "../lib/storage";

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const router: IRouter = Router();

router.get("/cases/:caseId/documents", requireAuth, async (req, res): Promise<void> => {
  const params = ListCaseDocumentsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [landCase] = await db.select().from(casesTable).where(eq(casesTable.caseId, params.data.caseId));
  if (!landCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const rows = await db
    .select()
    .from(documentsTable)
    .where(eq(documentsTable.caseId, params.data.caseId))
    .orderBy(documentsTable.serialNumber);
  const validTypes = new Set(["UNKNOWN", "SALE_DEED", "KHASRA_RECORD", "MUTATION_RECORD", "OWNERSHIP_CERTIFICATE", "REGISTRATION_RECORD"]);
  const sanitizedRows = rows.map((r) => ({
    ...r,
    documentType: validTypes.has(r.documentType) ? r.documentType : "UNKNOWN",
  }));
  res.json(ListCaseDocumentsResponse.parse(sanitizedRows));
});

router.post("/cases/:caseId/documents", requireAuth, async (req, res): Promise<void> => {
  const params = CreateCaseDocumentParams.safeParse(req.params);
  const parsed = CreateCaseDocumentBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (!parsed.data.filePath.startsWith("/objects/") || parsed.data.fileSize > MAX_FILE_SIZE) {
    res.status(400).json({ error: "Invalid private object path or file size" });
    return;
  }
  const [landCase] = await db.select().from(casesTable).where(eq(casesTable.caseId, params.data.caseId));
  if (!landCase) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  const [{ nextSerial }] = await db
    .select({ nextSerial: sql<number>`coalesce(max(${documentsTable.serialNumber}), 0) + 1` })
    .from(documentsTable)
    .where(eq(documentsTable.caseId, params.data.caseId));
  await privateStorage.setOwner(parsed.data.filePath, currentUserId(res));
  const [created] = await db
    .insert(documentsTable)
    .values({
      id: randomUUID(),
      caseId: params.data.caseId,
      serialNumber: Number(nextSerial),
      filename: parsed.data.filename,
      documentType: parsed.data.documentType ?? "UNKNOWN",
      filePath: parsed.data.filePath,
      mimeType: parsed.data.mimeType,
      fileSize: parsed.data.fileSize,
      uploadStatus: "UPLOADED",
      processingStatus: "NOT_STARTED",
    })
    .returning();
  res.status(201).json(CreateCaseDocumentResponse.parse(created));
});

router.delete("/documents/:documentId", requireAuth, async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [document] = await db
    .select({ id: documentsTable.id, filePath: documentsTable.filePath })
    .from(documentsTable)
    .innerJoin(casesTable, eq(casesTable.caseId, documentsTable.caseId))
    .where(eq(documentsTable.id, params.data.documentId));
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await privateStorage.delete(document.filePath);
  await db.delete(documentsTable).where(eq(documentsTable.id, params.data.documentId));
  res.sendStatus(204);
});

router.get("/storage/objects/{*objectPath}", requireAuth, async (req, res): Promise<void> => {
  const raw = req.params.objectPath;
  const pieces = Array.isArray(raw) ? raw : [raw];
  const objectPath = `/objects/${pieces.join("/")}`;
  if (!(await privateStorage.canRead(objectPath, currentUserId(res)))) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  const response = await privateStorage.download(objectPath);
  res.status(200);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const body = response.body;
  if (!body) {
    res.end();
    return;
  }
  const reader = body.getReader();
  const pump = async (): Promise<void> => {
    const { done, value } = await reader.read();
    if (done) {
      res.end();
      return;
    }
    res.write(Buffer.from(value));
    await pump();
  };
  await pump();
});

export default router;