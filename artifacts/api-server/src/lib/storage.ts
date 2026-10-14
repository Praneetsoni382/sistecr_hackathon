import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const STORAGE_DIR = path.join(os.tmpdir(), "land_records_storage");
if (!fs.existsSync(STORAGE_DIR)) {
  try {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  } catch {}
}

function getSafeDiskPath(objectPath: string): string {
  const safeName = objectPath.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(STORAGE_DIR, safeName);
}

const inMemoryFiles = new Map<string, { buffer: Buffer; mimeType: string; owner: string }>();

export class PrivateStorage {
  async createUpload(): Promise<{ uploadURL: string; objectPath: string }> {
    const objectId = randomUUID();
    return {
      uploadURL: `/api/storage/uploads/direct/${objectId}`,
      objectPath: `/objects/uploads/${objectId}`,
    };
  }

  async saveFile(objectPath: string, buffer: Buffer, mimeType = "application/pdf", owner = "officer_field_101"): Promise<void> {
    // Keep in-memory buffer immediately accessible with 0ms disk overhead
    inMemoryFiles.set(objectPath, { buffer, mimeType, owner });
    try {
      const diskPath = getSafeDiskPath(objectPath);
      // Non-blocking async background persistence to prevent blocking CPU event loop
      fs.promises.writeFile(diskPath, buffer).catch(() => {});
      fs.promises.writeFile(`${diskPath}.meta`, JSON.stringify({ mimeType, owner })).catch(() => {});
    } catch (e) {
      console.warn("[PrivateStorage] Disk persist warning:", e);
    }
  }

  getFile(objectPath: string): { buffer: Buffer; mimeType: string; owner: string } | undefined {
    const mem = inMemoryFiles.get(objectPath);
    if (mem) return mem;

    try {
      const diskPath = getSafeDiskPath(objectPath);
      if (fs.existsSync(diskPath)) {
        const buffer = fs.readFileSync(diskPath);
        let mimeType = "application/pdf";
        let owner = "officer_field_101";
        if (fs.existsSync(`${diskPath}.meta`)) {
          try {
            const meta = JSON.parse(fs.readFileSync(`${diskPath}.meta`, "utf8"));
            mimeType = meta.mimeType || mimeType;
            owner = meta.owner || owner;
          } catch {}
        }
        const fileObj = { buffer, mimeType, owner };
        inMemoryFiles.set(objectPath, fileObj);
        return fileObj;
      }
    } catch (e) {
      console.warn("[PrivateStorage] Disk read error:", e);
    }
    return undefined;
  }

  async setOwner(objectPath: string, userId: string): Promise<void> {
    const existing = this.getFile(objectPath);
    if (existing) {
      existing.owner = userId;
      inMemoryFiles.set(objectPath, existing);
    } else {
      await this.saveFile(objectPath, Buffer.from("Sample land document data"), "application/pdf", userId);
    }
  }

  async canRead(objectPath: string, userId: string): Promise<boolean> {
    return true;
  }

  async delete(objectPath: string): Promise<void> {
    inMemoryFiles.delete(objectPath);
    try {
      const diskPath = getSafeDiskPath(objectPath);
      if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      if (fs.existsSync(`${diskPath}.meta`)) fs.unlinkSync(`${diskPath}.meta`);
    } catch {}
  }

  async download(objectPath: string): Promise<Response> {
    const file = this.getFile(objectPath);
    if (!file) {
      return new Response("File not found", {
        status: 404,
        statusText: "Not Found",
      });
    }

    return new Response(new Uint8Array(file.buffer), {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Length": String(file.buffer.length),
        "Cache-Control": "private, max-age=300",
      },
    });
  }
}

export const privateStorage = new PrivateStorage();
