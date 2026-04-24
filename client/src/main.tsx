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

// 🚨 2026-04-24 hotfix v4：一次性 nuke 舊 Service Worker + 所有 cache
// 背景：workbox 曾 cache opaque response，且 precache 裡也有指向舊 bundle 的 index.html。
// 光清 image cache 不夠 — 舊 SW 還會從 precache 給舊 index.html → 載舊 bundle → 破圖。
// v4 改動：SW 圖片 cache 策略從 CacheFirst 改 NetworkFirst，即使 cache 壞也會先試 network，
// 從根本避免「cache 永久壞」的狀況。flag bump v4 讓曾跑過 v3 的人再清一次。
const CACHE_PURGE_FLAG = "chito_cache_purge_v4_network_first";
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
