// Client-side persistent IndexedDB document store for 100% resilient scan retrieval across reloads and tab closures

const DB_NAME = "LandRecordDocumentStore";
const DB_VERSION = 1;
const STORE_NAME = "documents";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB not available in current environment"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveDocumentBlob(docId: string, dataUrl: string, mimeType?: string, fileName?: string): Promise<void> {
  if (!docId || !dataUrl) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const record = {
        id: docId,
        dataUrl,
        mimeType: mimeType || "application/pdf",
        fileName: fileName || "",
        updatedAt: Date.now(),
      };
      store.put(record);
      if (fileName && fileName !== docId) {
        store.put({
          id: fileName,
          dataUrl,
          mimeType: mimeType || "application/pdf",
          fileName,
          updatedAt: Date.now(),
        });
      }
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("[IDB Storage] Unable to persist document to IndexedDB:", err);
  }
}

export async function getDocumentBlob(docId: string, fileName?: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  if (!docId && !fileName) return null;
  try {
    const db = await openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);

      if (docId) {
        const req = store.get(docId);
        req.onsuccess = () => {
          if (req.result?.dataUrl) {
            resolve({ dataUrl: req.result.dataUrl, mimeType: req.result.mimeType || "application/pdf" });
            return;
          }
          if (fileName) {
            const req2 = store.get(fileName);
            req2.onsuccess = () => {
              if (req2.result?.dataUrl) {
                resolve({ dataUrl: req2.result.dataUrl, mimeType: req2.result.mimeType || "application/pdf" });
              } else {
                resolve(null);
              }
            };
            req2.onerror = () => resolve(null);
          } else {
            resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } else if (fileName) {
        const req2 = store.get(fileName);
        req2.onsuccess = () => {
          if (req2.result?.dataUrl) {
            resolve({ dataUrl: req2.result.dataUrl, mimeType: req2.result.mimeType || "application/pdf" });
          } else {
            resolve(null);
          }
        };
        req2.onerror = () => resolve(null);
      } else {
        resolve(null);
      }
    });
  } catch (err) {
    console.warn("[IDB Storage] Unable to retrieve document from IndexedDB:", err);
    return null;
  }
}

export async function deleteDocumentBlob(docId: string): Promise<void> {
  if (!docId) return;
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(docId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("[IDB Storage] Unable to delete document from IndexedDB:", err);
  }
}
