// 🛟 safe-storage — iOS PWA bug 救援層
//
// 為什麼需要：
//   iOS 17+ PWA 在 standalone 模式偶爾會清空 localStorage（系統清空）
//   但 IndexedDB 通常會保留 → 雙寫策略：localStorage 是快取、IndexedDB 是備援
//
// 用法：
//   await safeStorage.setItem("auth-token", token)
//   const token = await safeStorage.getItem("auth-token")
//
// 設計：
//   - setItem 雙寫：localStorage（同步、快）+ IndexedDB（非同步、可靠）
//   - getItem 先讀 localStorage、為 null 才查 IndexedDB（並回填 localStorage）
//   - removeItem 雙刪
//   - 不影響既有用 localStorage 直接讀寫的 code（漸進升級）

import { reportClientEvent } from "./event-report";

const DB_NAME = "chito-safe-storage";
const DB_VERSION = 1;
const STORE = "kv";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function idbGet(key: string): Promise<string | null> {
  const db = await openDB();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string | undefined) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet(key: string, value: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function idbDel(key: string): Promise<void> {
  const db = await openDB();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function lsGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function lsDel(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export const safeStorage = {
  /** 讀：先讀 localStorage、為 null 查 IndexedDB（並回填 localStorage）*/
  async getItem(key: string): Promise<string | null> {
    const ls = lsGet(key);
    if (ls !== null) return ls;
    const idb = await idbGet(key);
    if (idb !== null) {
      // iOS PWA bug 偵測：localStorage 沒有但 IndexedDB 有 → 系統清空過、回填
      lsSet(key, idb);
      reportClientEvent({
        event: "safe_storage_restored",
        message: `localStorage cleared but IndexedDB had backup (key=${key})`,
        context: { key },
      });
    }
    return idb;
  },

  /** 寫：同步寫 localStorage + 非同步寫 IndexedDB（雙寫）*/
  setItem(key: string, value: string): void {
    lsSet(key, value);
    void idbSet(key, value);
  },

  /** 刪：雙刪 */
  removeItem(key: string): void {
    lsDel(key);
    void idbDel(key);
  },

  /** 同步讀（不含 IndexedDB 回填、給對效能敏感的場景）*/
  getItemSync(key: string): string | null {
    return lsGet(key);
  },
};

/** 對「重要 key」啟動時做一次同步：確保 localStorage = IndexedDB（修復 iOS bug） */
export async function rehydrateImportantKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    const ls = lsGet(key);
    const idb = await idbGet(key);
    if (ls === null && idb !== null) {
      lsSet(key, idb);
      reportClientEvent({
        event: "safe_storage_rehydrated",
        message: `rehydrated key from IndexedDB (key=${key})`,
        context: { key },
      });
    } else if (ls !== null && idb === null) {
      // 反向：localStorage 有、IndexedDB 沒 → 補寫 IndexedDB（首次升級）
      void idbSet(key, ls);
    }
  }
}
