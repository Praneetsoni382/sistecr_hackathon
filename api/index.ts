import type { Request, Response } from "express";
import app from "../artifacts/api-server/src/app.js";
import router from "../artifacts/api-server/src/routes/index.js";

// Ensure root health check is accessible
app.get("/healthz", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Support calls where /api prefix might be stripped by proxy/rewrites
app.use(router);

export default function handler(req: Request, res: Response) {
  return app(req, res);
}
