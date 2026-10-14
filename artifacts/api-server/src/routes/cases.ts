import { randomUUID } from "node:crypto";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  CreateCaseBody,
  CreateCaseResponse,
  GetCaseParams,
  GetCaseResponse,
  ListCasesQueryParams,
  ListCasesResponse,
} from "@workspace/api-zod";
import { db, casesTable, documentsTable } from "@workspace/db";
import { currentUserId, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

async function caseWithCount(caseRow: typeof casesTable.$inferSelect) {
  const [{ documentCount }] = await db
    .select({ documentCount: sql<number>`count(${documentsTable.id})::int` })
    .from(documentsTable)
    .where(eq(documentsTable.caseId, caseRow.caseId));
  return { ...caseRow, documentCount: Number(documentCount ?? 0) };
}

function nextCaseId(rows: Array<{ caseId: string }>): string {
  const year = new Date().getFullYear();
  const prefix = `LA-${year}-`;
  const highest = rows.reduce((max, row) => {
    if (!row.caseId.startsWith(prefix)) return max;
    const numeric = Number(row.caseId.slice(prefix.length));
    return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
  }, 0);
  return `${prefix}${String(highest + 1).padStart(5, "0")}`;
}

router.get("/cases", requireAuth, async (req, res): Promise<void> => {
  const parsed = ListCasesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const search = parsed.data.search?.trim();
  const rows = await db
    .select()
    .from(casesTable)
    .where(
      search
        ? or(
            ilike(casesTable.caseId, `%${search}%`),
            ilike(casesTable.projectName, `%${search}%`),
            ilike(casesTable.village, `%${search}%`),
            ilike(casesTable.district, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(casesTable.updatedAt));
  const result = await Promise.all(rows.map(caseWithCount));
  res.json(ListCasesResponse.parse(result));
});

router.post("/cases", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateCaseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const existing = await db.select({ caseId: casesTable.caseId }).from(casesTable);
  const [created] = await db
    .insert(casesTable)
    .values({
      id: randomUUID(),
      caseId: nextCaseId(existing),
      projectName: parsed.data.projectName,
      district: parsed.data.district,
      village: parsed.data.village,
      acquisitionReference: parsed.data.acquisitionReference ?? "",
      description: parsed.data.description ?? "",
      status: "DRAFT",
      createdBy: currentUserId(res),
    })
    .returning();
  res.status(201).json(CreateCaseResponse.parse({ ...created, documentCount: 0 }));
});

router.get("/cases/:caseId", requireAuth, async (req, res): Promise<void> => {
  const params = GetCaseParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db.select().from(casesTable).where(eq(casesTable.caseId, params.data.caseId));
  if (!row) {
    res.status(404).json({ error: "Case not found" });
    return;
  }
  res.json(GetCaseResponse.parse(await caseWithCount(row)));
});

export default router;