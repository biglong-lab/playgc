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

// 🚨 2026-04-25 hotfix v6：再次強制所有使用者清快取
// 背景：使用者反映連拍合成卡住不動，經查是 PWA 舊 bundle 導致（新 code 無 20s deadline）
// v6 bump 一次性清除所有曾經用 v5 flag 的使用者，讓他們拿到最新的連拍修復
const CACHE_PURGE_FLAG = "chito_cache_purge_v6_burst_deadline_fix";
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

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
