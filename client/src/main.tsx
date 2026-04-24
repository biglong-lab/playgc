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

// 🚨 2026-04-24 hotfix：一次性清除舊的 image cache（workbox 曾 cache opaque response 造成破圖）
// 每次版本升級後首次載入時執行一次；之後正常使用 SW cache 不再清
// 當 workbox 設定修正為 statuses: [200]，舊 cache 裡還殘留的 0-byte opaque response 不會自動清掉，
// 必須主動在使用者端清除一次。
const CACHE_PURGE_FLAG = "chito_cache_purge_v2_opaque_fix";
if (typeof window !== "undefined" && "caches" in window && !localStorage.getItem(CACHE_PURGE_FLAG)) {
  caches
    .keys()
    .then((keys) => {
      // 只清 image 相關的 runtime cache，precache（含 JS/CSS）留給 workbox cleanupOutdatedCaches 處理
      const imageCaches = keys.filter((k) => k.includes("images"));
      return Promise.all(imageCaches.map((k) => caches.delete(k)));
    })
    .then(() => {
      try {
        localStorage.setItem(CACHE_PURGE_FLAG, new Date().toISOString());
      } catch {
        /* localStorage 不可用就算了 — 下次載入會再試 */
      }
    })
    .catch(() => {
      // 清 cache 失敗不可 block 應用啟動
    });
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
