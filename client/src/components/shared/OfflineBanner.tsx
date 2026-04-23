// 離線狀態橫幅通知 — 顯示離線多久 + 可手動關閉
import { useEffect, useState } from "react";
import { WifiOff, Wifi, X } from "lucide-react";

interface OfflineBannerProps {
  readonly isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const [show, setShow] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  // 🆕 離線起點 + 手動關閉
  const [offlineStart, setOfflineStart] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // 🆕 計時用 tick（強制 re-render 更新「離線 N 分鐘」）
  const [, setNowTick] = useState(0);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      setWasOffline(true);
      setDismissed(false);
      if (!offlineStart) setOfflineStart(Date.now());
    } else if (wasOffline) {
      // 恢復連線 → 顯示 2 秒後消失
      setShow(true);
      setOfflineStart(null);
      const timer = setTimeout(() => {
        setShow(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline, offlineStart]);

  // 🆕 每 30s re-render 更新「已離線 X 分鐘」
  useEffect(() => {
    if (!offlineStart) return;
    const interval = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, [offlineStart]);

  if (!show) return null;
  // 離線期間使用者關閉後不顯示；恢復連線的成功訊息則一定會顯示
  if (!isOnline && dismissed) return null;

  const offlineMinutes = offlineStart
    ? Math.floor((Date.now() - offlineStart) / 60000)
    : 0;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2
        px-4 py-2 text-sm font-medium transition-colors
        ${isOnline ? "bg-green-600/90 text-white" : "bg-amber-600/90 text-white"}`}
      role="status"
      aria-live="polite"
      data-testid="offline-banner"
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          已恢復連線，進度已同步
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 shrink-0" />
          <span className="flex items-center gap-1 flex-wrap justify-center">
            <span>目前離線中</span>
            {offlineMinutes > 0 && (
              <span className="opacity-80 font-mono text-xs">
                （已離線 {offlineMinutes} 分鐘）
              </span>
            )}
            <span className="opacity-90">— 進度會在恢復連線後自動同步</span>
          </span>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="ml-2 hover:opacity-70 transition-opacity shrink-0"
            aria-label="關閉離線提示"
            data-testid="button-dismiss-offline"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}
    </div>
  );
}
