// 離線狀態通知 — v2 (F2 2026-04-24)
// 改為醒目的卡片式 modal（背景暗化 + 脈衝動畫 + 立即重試按鈕）
// 恢復連線顯示 toast 並自動消失
import { useEffect, useState } from "react";
import { WifiOff, Wifi, X, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface OfflineBannerProps {
  readonly isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const [show, setShow] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineStart, setOfflineStart] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  // 🆕 計時用 tick（每 10s 強制 re-render 更新「離線 X 分鐘」）
  const [, setNowTick] = useState(0);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      setWasOffline(true);
      setDismissed(false);
      if (!offlineStart) setOfflineStart(Date.now());
    } else if (wasOffline) {
      // 恢復連線 → 顯示 2 秒後消失（成功 toast）
      setShow(true);
      setOfflineStart(null);
      setRetryCount(0);
      const timer = setTimeout(() => {
        setShow(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, offlineStart]);

  // 每 10s tick 更新離線時間顯示
  useEffect(() => {
    if (!offlineStart) return;
    const interval = setInterval(() => setNowTick((n) => n + 1), 10_000);
    return () => clearInterval(interval);
  }, [offlineStart]);

  if (!show) return null;

  const offlineMinutes = offlineStart
    ? Math.floor((Date.now() - offlineStart) / 60_000)
    : 0;
  const offlineSeconds = offlineStart
    ? Math.floor((Date.now() - offlineStart) / 1_000)
    : 0;

  // 🆕 手動重試：打 /api/health 測連線
  const handleManualRetry = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryCount((n) => n + 1);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch("/api/health", {
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        // 連線成功，通常 navigator.onLine 會自動更新；強制觸發 online event 確保 hook 同步
        window.dispatchEvent(new Event("online"));
      }
    } catch {
      /* 仍然斷線 */
    } finally {
      setIsRetrying(false);
    }
  };

  // ✅ 恢復連線 toast
  if (isOnline) {
    return (
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-success text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-4 fade-in"
        role="status"
        aria-live="polite"
        data-testid="offline-recovered-toast"
      >
        <Wifi className="w-4 h-4" />
        已恢復連線，進度已同步
      </div>
    );
  }

  // 使用者關閉後不顯示完整 modal（但保留邊緣小提示）
  if (dismissed) {
    return (
      <button
        type="button"
        onClick={() => setDismissed(false)}
        className="fixed top-4 right-4 z-[100] bg-warning text-warning-foreground px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 text-xs font-medium animate-pulse"
        aria-label="重新打開離線提示"
        data-testid="button-reopen-offline"
      >
        <WifiOff className="w-3.5 h-3.5" />
        離線中
      </button>
    );
  }

  // ⚠️ 完整離線 modal — 背景暗化 + 醒目卡片 + 脈衝動畫 + 立即重試按鈕
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm animate-in fade-in duration-300"
      role="alertdialog"
      aria-live="assertive"
      data-testid="offline-modal"
    >
      <div className="bg-card border-2 border-warning/60 rounded-2xl shadow-2xl max-w-sm w-full p-6 relative animate-in zoom-in-95 duration-300">
        {/* 關閉按鈕（讓使用者知道可以關，但橫幅會保留） */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute top-3 right-3 text-muted-foreground/50 hover:text-muted-foreground p-1.5 rounded hover:bg-muted"
          aria-label="縮小（保留上方提示）"
          data-testid="button-dismiss-offline"
        >
          <X className="w-4 h-4" />
        </button>

        {/* 脈衝 icon */}
        <div className="flex justify-center mb-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-warning/30 animate-ping" />
            <div className="relative w-16 h-16 rounded-full bg-warning/20 flex items-center justify-center">
              <WifiOff className="w-8 h-8 text-warning" />
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold text-center mb-2">目前離線中</h2>
        <p className="text-sm text-muted-foreground text-center mb-1">
          網路連線已中斷，已離線{" "}
          <span className="font-semibold text-foreground">
            {offlineMinutes > 0 ? `${offlineMinutes} 分鐘` : `${offlineSeconds} 秒`}
          </span>
        </p>
        <p className="text-xs text-muted-foreground text-center mb-4">
          你的進度會自動保留，恢復連線後同步
        </p>

        {retryCount > 0 && (
          <p className="text-xs text-center text-muted-foreground/70 mb-3">
            已嘗試重連 {retryCount} 次
          </p>
        )}

        <Button
          onClick={handleManualRetry}
          disabled={isRetrying}
          className="w-full gap-2 h-11"
          data-testid="button-retry-connection"
        >
          <RefreshCcw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
          {isRetrying ? "重連中..." : "立即重試"}
        </Button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="w-full mt-2 text-xs text-muted-foreground/70 hover:text-muted-foreground py-1"
          data-testid="button-offline-continue"
        >
          繼續操作（可能會失敗）
        </button>
      </div>
    </div>
  );
}
