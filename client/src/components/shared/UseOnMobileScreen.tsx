import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Smartphone, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDeviceType } from "@/hooks/useDeviceType";

const FORCE_KEY = "device-gate:force-enter";

interface Props {
  targetUrl?: string;
  onForceEnter?: () => void;
}

export default function UseOnMobileScreen({ targetUrl, onForceEnter }: Props) {
  const device = useDeviceType();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);

  const url = targetUrl ?? (typeof window !== "undefined" ? window.location.href : "");

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    QRCode.toDataURL(url, { width: 280, margin: 1, color: { dark: "#111827", light: "#ffffff" } })
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

  const handleForce = () => {
    try {
      localStorage.setItem(FORCE_KEY, "1");
    } catch {
      // ignore
    }
    onForceEnter?.();
    window.location.reload();
  };

  const tip =
    device.type === "tablet"
      ? "您正在使用平板。為了給玩家最好的體驗，遊戲過程僅在手機開放使用。"
      : "您正在使用電腦。為了給玩家最好的體驗，遊戲過程僅在手機開放使用。";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-4">
          <Smartphone className="w-8 h-8 text-blue-600 dark:text-blue-300" />
        </div>

        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
          請用手機開始遊戲
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{tip}</p>

        {qrDataUrl ? (
          <div className="flex justify-center mb-4">
            <img
              src={qrDataUrl}
              alt="掃描以用手機開啟"
              className="w-56 h-56 rounded-lg border border-slate-200 dark:border-slate-700"
            />
          </div>
        ) : (
          <div className="w-56 h-56 mx-auto rounded-lg bg-slate-100 dark:bg-slate-700 animate-pulse mb-4" />
        )}

        <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
          用手機相機掃描 QR Code、即可繼續遊戲
        </p>

        <button
          type="button"
          onClick={() => setShowWhy((v) => !v)}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-3"
        >
          為什麼限手機？
          {showWhy ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showWhy && (
          <div className="text-left text-sm text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-4 space-y-2">
            <p>遊戲過程會用到：</p>
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>📷 相機（拍照任務）</li>
              <li>📍 GPS（地圖導引）</li>
              <li>🧭 指南針（方向感應）</li>
              <li>📳 震動（即時回饋）</li>
              <li>🎤 麥克風（語音對講）</li>
            </ul>
            <p className="mt-2">手機體驗最完整、操作最順暢。</p>
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleForce}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          我已了解、仍要在此繼續
        </Button>
      </div>
    </div>
  );
}

export function hasForceEnterFlag(): boolean {
  try {
    return localStorage.getItem(FORCE_KEY) === "1";
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
