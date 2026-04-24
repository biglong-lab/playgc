import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import "./index.css";

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
//   每次啟動 fetch /api/version，若 server commit !== client commit → 清快取 reload
//   這樣未來不用再 bump CACHE_PURGE_FLAG，使用者永遠拿到最新版
if (typeof window !== "undefined" && CLIENT_COMMIT !== "unknown") {
  (async () => {
    try {
      // 等 1 秒讓主流程先啟動（避免阻塞首屏）
      await new Promise((r) => setTimeout(r, 1000));
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) return;
      const { commit: serverCommit } = await res.json();
      console.log(
        `[version-check] client=${CLIENT_COMMIT} server=${serverCommit}`,
      );
      if (serverCommit && serverCommit !== CLIENT_COMMIT) {
        console.warn(
          `[version-check] 🔄 版本不符，強制清快取 reload (${CLIENT_COMMIT} → ${serverCommit})`,
        );
        // 清所有 SW + cache
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
        }
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        localStorage.setItem(LAST_COMMIT_KEY, serverCommit);
        // 只 reload 一次避免無限迴圈（用 session flag）
        if (!sessionStorage.getItem("chito_version_reloaded")) {
          sessionStorage.setItem("chito_version_reloaded", "1");
          window.location.reload();
        }
      } else if (serverCommit) {
        localStorage.setItem(LAST_COMMIT_KEY, serverCommit);
        sessionStorage.removeItem("chito_version_reloaded"); // 重置
      }
    } catch {
      // 無網路也不阻塞
    }
  })();
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
