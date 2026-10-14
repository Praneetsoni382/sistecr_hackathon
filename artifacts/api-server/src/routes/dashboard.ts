import { desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { GetDashboardSummaryResponse, GetRecentActivityResponse } from "@workspace/api-zod";
import { db, casesTable, documentsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (_req, res): Promise<void> => {
  const [{ totalCases }] = await db.select({ totalCases: sql<number>`count(*)::int` }).from(casesTable);
  const [{ documentsUploaded }] = await db.select({ documentsUploaded: sql<number>`count(*)::int` }).from(documentsTable);
  const [{ documentsProcessed }] = await db
    .select({ documentsProcessed: sql<number>`count(*)::int` })
    .from(documentsTable)
    .where(eq(documentsTable.processingStatus, "COMPLETED"));
  const [{ recordsVerified }] = await db
    .select({ recordsVerified: sql<number>`count(*)::int` })
    .from(casesTable)
    .where(eq(casesTable.status, "VERIFIED"));
  const [{ recordsRequiringReview }] = await db
    .select({ recordsRequiringReview: sql<number>`count(*)::int` })
    .from(casesTable)
    .where(eq(casesTable.status, "REVIEW_REQUIRED"));
  const [{ conflictsDetected }] = await db
    .select({ conflictsDetected: sql<number>`count(*)::int` })
    .from(casesTable)
    .where(eq(casesTable.status, "INCONSISTENT"));
  res.json(
    GetDashboardSummaryResponse.parse({
      totalCases: Number(totalCases),
      documentsUploaded: Number(documentsUploaded),
      documentsProcessed: Number(documentsProcessed),
      recordsVerified: Number(recordsVerified),
      recordsRequiringReview: Number(recordsRequiringReview),
      conflictsDetected: Number(conflictsDetected),
    }),
  );
});

router.get("/activity", requireAuth, async (_req, res): Promise<void> => {
  const recentCases = await db.select().from(casesTable).orderBy(desc(casesTable.createdAt)).limit(6);
  const recentDocuments = await db.select().from(documentsTable).orderBy(desc(documentsTable.createdAt)).limit(6);
  const activities = [
    ...recentCases.map((item: any) => ({
      id: `case-${item.id}`,
      kind: "CASE_CREATED" as const,
      title: "Case created",
      detail: `${item.caseId} · ${item.projectName}`,
      timestamp: item.createdAt,
    })),
    ...recentDocuments.map((item: any) => ({
      id: `document-${item.id}`,
      kind: "DOCUMENT_UPLOADED" as const,
      title: "Document uploaded",
      detail: `${item.filename} · ${item.caseId}`,
      timestamp: item.createdAt,
    })),
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 8);
  res.json(GetRecentActivityResponse.parse(activities));
});

export default router;