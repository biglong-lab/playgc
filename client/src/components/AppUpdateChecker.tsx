// 🔄 App 版本自動檢查器
//
// 問題：每次推新版，使用者瀏覽器的 PWA Service Worker 不一定立刻更新，
//      導致看到舊 bundle 甚至 TypeError，必須手動「清除快取重新載入」。
//
// 解法：
//   1. 每 5 分鐘 fetch 最新 /（cache: "no-store"）
//   2. 解析出 <script src="/assets/index-XXX.js"> 的 hash
//   3. 若跟當前執行的 bundle hash 不同 → 顯示「立即更新」Toast
//   4. 使用者點更新 → registration.update() + window.location.reload()
//
// 為什麼不用 vite-plugin-pwa 的 useRegisterSW？
//   那個 hook 依賴 navigator.serviceWorker.register 的內建更新，
//   但瀏覽器有時 24h 才檢查一次 SW update。
//   主動 poll HTML bundle hash 才是最可靠的版本判定。
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { RotateCw, X } from "lucide-react";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 分鐘
const INITIAL_CHECK_DELAY_MS = 5 * 1000; // 🆕 改為 5 秒（剛上線時快速提示使用者點更新，30s 太久）
const BUNDLE_HASH_REGEX = /index-([A-Za-z0-9_-]+)\.js/;

/** 從 HTML 字串抽出 bundle hash */
function extractBundleHash(html: string): string | null {
  const m = html.match(BUNDLE_HASH_REGEX);
  return m ? m[1] : null;
}

/** 取得當前執行中的 bundle hash（從 DOM） */
function getCurrentBundleHash(): string | null {
  if (typeof document === "undefined") return null;
  const script = document.querySelector<HTMLScriptElement>(
    'script[type="module"][src*="/assets/index-"]',
  );
  if (!script) return null;
  const m = script.src.match(BUNDLE_HASH_REGEX);
  return m ? m[1] : null;
}

export default function AppUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const currentHash = getCurrentBundleHash();
    if (!currentHash) return; // dev mode 或 bundle 結構不符 → 不檢查

    const check = async () => {
      try {
        const res = await fetch(`/?_v=${Date.now()}`, {
          cache: "no-store",
          credentials: "omit",
        });
        if (!res.ok) return;
        const html = await res.text();
        const latestHash = extractBundleHash(html);
        if (!latestHash) return;
        if (latestHash !== currentHash) {
          setUpdateAvailable(true);
        }
      } catch {
        /* 網路斷線或 CORS — 下次再試 */
      }
    };

    const initialTimer = setTimeout(check, INITIAL_CHECK_DELAY_MS);
    const intervalTimer = setInterval(check, CHECK_INTERVAL_MS);

    // 每次使用者切回 tab 時也檢查一次（可能離開久了）
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        check();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!updateAvailable || dismissed) return null;

  const handleUpdate = async () => {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
    } catch {
      /* 拿不到 registration 也直接 reload，reload 自己會拿新資源 */
    }
    window.location.reload();
  };

  return (
    <div
      className="fixed bottom-4 right-4 left-4 sm:left-auto z-[100] bg-card border-2 border-primary/40 rounded-xl shadow-2xl p-4 sm:max-w-sm animate-in slide-in-from-bottom-4 fade-in"
      role="alert"
      data-testid="app-update-toast"
    >
      {/* 右上角關閉（小 X） */}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 text-muted-foreground/50 hover:text-muted-foreground p-1.5 rounded hover:bg-muted/60"
        aria-label="關閉（稍後再更新）"
        data-testid="button-app-update-dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 內容區（頂部 icon + 文字） */}
      <div className="flex items-start gap-3 pr-8 mb-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <RotateCw className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="font-semibold text-sm">有新版本可用 🎉</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
            更新取得最新功能與修復
          </p>
        </div>
      </div>

      {/* 🆕 立即更新按鈕 — 佔滿寬度、夠大好點（iOS tap target ≥ 44px） */}
      <Button
        onClick={handleUpdate}
        className="w-full gap-2 h-11 text-base font-semibold"
        data-testid="button-app-update"
      >
        <RotateCw className="w-4 h-4" />
        立即更新
      </Button>
    </div>
  );
}
