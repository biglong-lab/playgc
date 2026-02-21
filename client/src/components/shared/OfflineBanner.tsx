// 離線狀態橫幅通知
import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

interface OfflineBannerProps {
  readonly isOnline: boolean;
}

export default function OfflineBanner({ isOnline }: OfflineBannerProps) {
  const [show, setShow] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShow(true);
      setWasOffline(true);
    } else if (wasOffline) {
      // 恢復連線 → 顯示 2 秒後消失
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (!show) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[60] flex items-center justify-center gap-2
        px-4 py-2 text-sm font-medium transition-colors
        ${isOnline ? "bg-green-600/90 text-white" : "bg-amber-600/90 text-white"}`}
      role="status"
      aria-live="polite"
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4" />
          已恢復連線，進度已同步
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4" />
          目前離線中 — 遊戲進度將在恢復連線後自動同步
        </>
      )}
    </div>
  );
}
