import { useEffect, useState } from "react";
import { Smartphone, ChevronDown, ChevronUp } from "lucide-react";
import { useDeviceType } from "@/hooks/useDeviceType";

const FORCE_KEY = "device-gate:force-enter";
const FORCE_VALUE = "v2";
const URL_FORCE_PARAM = "force-device";

interface Props {
  targetUrl?: string;
}

export default function UseOnMobileScreen({ targetUrl }: Props) {
  const device = useDeviceType();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const url = targetUrl ?? (typeof window !== "undefined" ? window.location.href : "");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    // 📦 2026-07-09 B2（全站優化盤點）：qrcode 改動態載入 —
    //   此元件在首屏引用鏈上，靜態 import 會把 qrcode 庫拉進主 bundle
    import("qrcode")
      .then((QRCode) =>
        QRCode.toDataURL(url, { width: 280, margin: 1, color: { dark: "#111827", light: "#ffffff" } }),
      )
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  // 🆕 2026-05-20：平板已開放、僅擋桌機
  const tip = "您正在使用電腦。遊戲過程僅在手機或平板開放、請改用行動裝置繼續。";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-300" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          請改用手機或平板
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{tip}</p>

        {qrDataUrl ? (
          <div className="flex justify-center mb-4">
            <img
              src={qrDataUrl}
              alt="掃描以用行動裝置開啟"
              className="w-56 h-56 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
        ) : (
          <div className="w-56 h-56 mx-auto rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse mb-4" />
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          用手機 / 平板的相機掃描 QR Code、即可繼續遊戲
        </p>

        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        >
          為什麼限行動裝置？
          {showWhy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showWhy && (
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mt-3 space-y-2">
            <p>遊戲過程會用到：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>📷 相機（拍照任務）</li>
              <li>📍 GPS（地圖導引）</li>
              <li>🧭 指南針（方向感應）</li>
              <li>📳 震動（即時回饋）</li>
              <li>🎤 麥克風（語音對講）</li>
            </ul>
            <p className="mt-2">手機 / 平板體驗最完整、操作最順暢。</p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * 檢查是否有 force-enter 豁免（後門機制、不顯示在 UI）：
 *
 * 1. URL 參數 `?force-device=1`（demo / 業務 pitch 用、可分享網址）
 *    第一次帶參數會自動寫入 localStorage、之後同瀏覽器免再帶
 * 2. localStorage `device-gate:force-enter=1`（開發者 DevTools 手動設）
 *
 * 玩家看不到任何按鈕、無法自行觸發。
 */
export function hasForceEnterFlag(): boolean {
  try {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get(URL_FORCE_PARAM) === "1") {
        localStorage.setItem(FORCE_KEY, FORCE_VALUE);
        return true;
      }
    }
    // 舊版（"1"）自動失效、只認新版本（FORCE_VALUE）。
    // 業主想 demo → 用 `?force-device=1` 重新觸發、會寫入新值。
    return localStorage.getItem(FORCE_KEY) === FORCE_VALUE;
  } catch {
    return false;
  }
}

export function clearForceEnterFlag(): void {
  try {
    localStorage.removeItem(FORCE_KEY);
  } catch {
    // ignore
  }
}
