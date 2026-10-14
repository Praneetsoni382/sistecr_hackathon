import { getAuth } from "@clerk/express";
import type { NextFunction, Request, Response } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const auth = getAuth(req);
    if (auth?.userId) {
      res.locals.userId = auth.userId;
      res.locals.sessionClaims = auth.sessionClaims;
      return next();
    }
  } catch {
    // Ignore error if Clerk is not initialized or configured
  }

  // Fallback demo user if Clerk is not configured
  if (!process.env.CLERK_SECRET_KEY && !process.env.CLERK_PUBLISHABLE_KEY) {
    res.locals.userId = "officer_field_101";
    res.locals.sessionClaims = {
      firstName: "Aditya",
      lastName: "Sharma",
      email: "aditya.sharma@landrecords.gov.in",
    };
    return next();
  }

  res.status(401).json({ error: "Unauthorized" });
}

export function currentUserId(res: Response): string {
  return res.locals.userId as string;
}

export function currentClaims(res: Response): Record<string, unknown> {
  return (res.locals.sessionClaims as Record<string, unknown> | undefined) ?? {};
}