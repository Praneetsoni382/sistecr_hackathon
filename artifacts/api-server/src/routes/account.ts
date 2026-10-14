import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { GetMeResponse } from "@workspace/api-zod";
import { db, profilesTable } from "@workspace/db";
import { currentClaims, currentUserId, requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/me", requireAuth, async (_req, res): Promise<void> => {
  const userId = currentUserId(res);
  const claims = currentClaims(res);
  const firstName = typeof claims.firstName === "string" ? claims.firstName : "";
  const lastName = typeof claims.lastName === "string" ? claims.lastName : "";
  const email = typeof claims.email === "string" ? claims.email : `${userId}@clerk.local`;
  const fullName = `${firstName} ${lastName}`.trim() || "Field Officer";

  const existing = await db.select().from(profilesTable).where(eq(profilesTable.id, userId));
  if (existing[0]) {
    res.json(GetMeResponse.parse(existing[0]));
    return;
  }

  const [profile] = await db
    .insert(profilesTable)
    .values({ id: userId, fullName, email, role: "OFFICER", department: "Land Records" })
    .returning();
  res.status(201).json(GetMeResponse.parse(profile));
});

export default router;