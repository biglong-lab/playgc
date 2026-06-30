import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./index.css";
import { logAppLaunch } from "@/lib/pwa-analytics";
import { initWebVitals } from "@/lib/web-vitals-report";
import { initSentry } from "@/lib/sentry";
import { rehydrateImportantKeys } from "@/lib/safe-storage";

// 🐛 Phase 1 (2026-05-10)：Sentry 錯誤監控（VITE_SENTRY_DSN 留空就 disabled）
//   必須在 createRoot 之前 init、確保 React component error 被 capture
initSentry();

// 🛟 iOS PWA bug 救援：啟動時從 IndexedDB 還原可能被系統清空的 localStorage
//   非阻塞、失敗 silent
void rehydrateImportantKeys([
  "chito:lastVisitedField",
  "chitoUserName",
  "chitoFontScale",
  "lastFieldCode",
  "theme",
]);

// 🆕 Phase D：App 啟動時 log（PWA / browser / TWA 區分），給後台統計用
//   非阻塞，1 秒延遲讓 critical render 先完成
setTimeout(() => logAppLaunch(), 1000);

// 📐 Phase 4 (2026-05-10)：Web Vitals 收集（LCP / INP / CLS / FCP / TTFB）
//   只上報 needs-improvement / poor、節省流量
//   透過既有 reportClientEvent → /api/error-log（dedup + keepalive）
initWebVitals();

// 📊 Phase 2 (2026-05-10)：Cloudflare Web Analytics（選用）
//   .env 設 VITE_CF_BEACON_TOKEN 才啟用
//   完全免費、cookie-free、不影響隱私、不影響效能（defer + 5KB）
const cfBeaconToken = import.meta.env.VITE_CF_BEACON_TOKEN;
if (cfBeaconToken && typeof document !== "undefined") {
  const cfScript = document.createElement("script");
  cfScript.defer = true;
  cfScript.src = "https://static.cloudflareinsights.com/beacon.min.js";
  cfScript.setAttribute("data-cf-beacon", JSON.stringify({ token: cfBeaconToken }));
  document.head.appendChild(cfScript);
}

// 🆕 2026-06-13：chunk 載入失敗自動救援
//   部署後舊分頁去 lazy-import 已不存在的舊 chunk → "Importing a module script failed"。
//   直接拋到 ErrorBoundary（顯示錯誤畫面）、版本檢查還沒跑到。這裡攔截 → 清快取 + 立即重載新版。
function isChunkLoadError(msg?: string | null): boolean {
  const m = msg || "";
  return (
    /Importing a module script failed|Failed to fetch dynamically imported module|error loading dynamically imported module|module script failed|Load failed/i.test(m) ||
    // 🆕 2026-06-30：Safari React.lazy chunk 失敗 → render 拋 "undefined is not an object (evaluating '…._result.default')"
    (/_result/.test(m) && /is not an object|Cannot read|undefined is not|null is not/i.test(m))
  );
}
/**
 * 恢復節流：避免無限 reload，但「允許多次嘗試」。
 * 🆕 2026-06-30：舊版用一次性 flag，首次 reload 沒成功（SW/HTTP 快取殘留）就永久卡死、
 *   使用者重整半天也不恢復。改成「5 分鐘窗內最多 3 次、每次至少間隔 minIntervalMs」，
 *   讓系統能反覆嘗試直到清乾淨，又不會無限刷。
 */
function canRecover(key: string, minIntervalMs = 15000): boolean {
  try {
    const now = Date.now();
    const recent = (JSON.parse(sessionStorage.getItem(key) || "[]") as number[]).filter((t) => now - t < 300000);
    if (recent.length >= 3) return false;
    if (recent.length && now - recent[recent.length - 1] < minIntervalMs) return false;
    recent.push(now);
    sessionStorage.setItem(key, JSON.stringify(recent));
    return true;
  } catch {
    return true;
  }
}

async function recoverFromChunkError(): Promise<void> {
  if (!canRecover("chito_chunk_recover")) return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore
  }
  window.location.reload();
}
if (typeof window !== "undefined") {
  // Vite 官方：preload 的動態 chunk 失敗會 dispatch 此事件
  window.addEventListener("vite:preloadError", (e) => {
    e.preventDefault?.();
    void recoverFromChunkError();
  });
  window.addEventListener("error", (e) => {
    if (isChunkLoadError((e as ErrorEvent)?.message)) void recoverFromChunkError();
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = (e as PromiseRejectionEvent)?.reason;
    if (isChunkLoadError(reason?.message || String(reason))) void recoverFromChunkError();
  });
}

// Service Worker 更新時強制 reload，避免當前 tab 卡在舊 bundle
// （已設 skipWaiting + clientsClaim，但舊 JS 已載入 memory，需要 reload 才會拿新版）
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // 防止無限迴圈：只在第一次 controllerchange 時 reload
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

// 🚀 持續性版本比對：每次啟動 fetch /api/version 比對 commit，
//   若伺服器版本不符 localStorage 記錄的版本就強制清快取 reload
//   （取代原本的一次性 CACHE_PURGE_FLAG，從此不再靠 bump 版本號）
const LAST_COMMIT_KEY = "chito_last_known_commit";
const CLIENT_COMMIT = import.meta.env.VITE_APP_COMMIT || "unknown";

// 🆘 Legacy 一次性 purge flag（保留以防舊使用者還沒清過）
const CACHE_PURGE_FLAG = "chito_cache_purge_v7_version_check";
if (typeof window !== "undefined" && !localStorage.getItem(CACHE_PURGE_FLAG)) {
  (async () => {
    try {
      // 1. 先設 flag 避免下次 reload 再觸發（不管後面成不成）
      localStorage.setItem(CACHE_PURGE_FLAG, new Date().toISOString());

      let needsReload = false;

      // 2. Unregister 所有 Service Worker
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length > 0) {
          await Promise.all(regs.map((r) => r.unregister()));
          needsReload = true;
        }
      }

      // 3. 清除所有 cache storage
      if ("caches" in window) {
        const keys = await caches.keys();
        if (keys.length > 0) {
          await Promise.all(keys.map((k) => caches.delete(k)));
          needsReload = true;
        }
      }

      // 4. 需要 reload（只在有清東西時才 reload，避免無限迴圈）
      if (needsReload) {
        // 用 location.replace 避免進 history
        window.location.replace(window.location.href);
      }
    } catch {
      // 失敗不可 block 應用啟動
    }
  })();
}

// 🚀 持續性版本比對（取代一次性 purge flag）
//   3 個觸發時機確保 PWA 永遠自動更新：
//   1. app 啟動後 1 秒
//   2. document visible（使用者切回 app）
//   3. 每 60 秒定期檢查
//   任一時機偵測到 server commit 不符 → 清快取 reload
const checkVersion = async () => {
  // 🆕 2026-05-07：CLIENT_COMMIT === "unknown" 也檢查
  //   原本這行是 "unknown 時直接 return"、結果舊版 client（之前 deploy 漏注入 GIT_SHA）
  //   永遠卡在 "unknown"、永遠不檢查更新、被 AppUpdateChecker 的 toast 一直騷擾。
  //   改成：unknown 時也比對；若 server 是真實 commit 就視為版本不符、自動 reload。
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return;
    const { commit: serverCommit } = await res.json();
    if (!serverCommit || serverCommit === "unknown") return; // server 也是 unknown → 沒法判斷
    if (serverCommit === CLIENT_COMMIT) {
      localStorage.setItem(LAST_COMMIT_KEY, serverCommit);
      sessionStorage.removeItem("chito_version_recover"); // 版本一致 → 重置恢復計數
      return;
    }
    console.warn(
      `[version-check] 🔄 版本不符 (${CLIENT_COMMIT} → ${serverCommit})，自動清快取 reload`,
    );
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    localStorage.setItem(LAST_COMMIT_KEY, serverCommit);
    if (!sessionStorage.getItem("chito_version_reloaded")) {
      sessionStorage.setItem("chito_version_reloaded", "1");
      window.location.reload();
    }
  } catch {
    // 無網路不阻塞
  }
};

if (typeof window !== "undefined") {
  // 1. 啟動後 1 秒檢查
  setTimeout(checkVersion, 1000);
  // 2. 每 60 秒檢查一次（使用者持續用 app 也能自動更新）
  setInterval(checkVersion, 60000);
  // 3. visibilitychange：切回 app 時檢查（最常見場景）
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkVersion();
  });
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
