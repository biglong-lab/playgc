// 離線進度儲存 — IndexedDB 封裝
// 職責：離線時攔截 PATCH /api/sessions/:id/progress，
//       儲存至 IndexedDB，恢復連線後由 useOfflineSync 批次同步

const DB_NAME = "jiachun-offline";
const DB_VERSION = 1;
const STORE_PENDING = "pendingUpdates";

export interface PendingProgressUpdate {
  id: string;
  sessionId: string;
  pageId: string;
  score: number;
  inventory: string[];
  variables: Record<string, unknown>;
  timestamp: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: "id" });
        store.createIndex("sessionId", "sessionId");
        store.createIndex("timestamp", "timestamp");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** 加入待同步佇列（同 sessionId 覆蓋舊的，只保留最新進度） */
export async function queueProgressUpdate(
  update: Omit<PendingProgressUpdate, "id" | "timestamp">,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, "readwrite");
  const store = tx.objectStore(STORE_PENDING);

  const pending: PendingProgressUpdate = {
    ...update,
    id: update.sessionId,
    timestamp: Date.now(),
  };

  return new Promise((resolve, reject) => {
    const req = store.put(pending);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** 取出所有待同步項目（按時間排序） */
export async function getPendingUpdates(): Promise<PendingProgressUpdate[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, "readonly");
  const store = tx.objectStore(STORE_PENDING);

  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      db.close();
      const items = req.result as PendingProgressUpdate[];
      resolve(items.sort((a, b) => a.timestamp - b.timestamp));
    };
    req.onerror = () => reject(req.error);
  });
}

/** 刪除已同步的項目 */
export async function removePendingUpdate(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, "readwrite");

  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_PENDING).delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

/** 取得待同步數量 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_PENDING, "readonly");

  return new Promise((resolve, reject) => {
    const req = tx.objectStore(STORE_PENDING).count();
    req.onsuccess = () => {
      db.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error);
  });
}
