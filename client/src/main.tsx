import { createRoot } from "react-dom/client";
import { AuthProvider } from "./contexts/AuthContext";
import App from "./App";
import ErrorBoundary from "./components/shared/ErrorBoundary";
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

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>,
);
