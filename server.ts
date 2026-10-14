import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import apiApp from "./artifacts/api-server/src/app";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Healthcheck endpoint for Railway / Vercel / Cloud Run
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Mount the Express API routes at /api (and healthz/etc.)
  app.use(apiApp);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      configFile: path.resolve(process.cwd(), "artifacts/land-record-intelligence/vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const primaryDist = path.join(process.cwd(), "artifacts/land-record-intelligence/dist/public");
    const fallbackDist = path.join(process.cwd(), "dist");
    const distPath = fs.existsSync(path.join(primaryDist, "index.html")) ? primaryDist : fallbackDist;
    app.use(express.static(distPath));
    app.use((req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Land Record Intelligence Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
