// 📢 AnnouncementBanner — 場域公告顯示條
//
// 用途：Landing / Home 頂部顯示場域公告（場域管理員在後台設定）
//
// 特性：
//   - 有公告才顯示，沒公告 render null
//   - 玩家可點 X 關閉當次 session
//   - 用 sessionStorage 記憶 hash（公告內容變了會自動重新顯示）
//   - 重開分頁（新 session）會再顯示一次（確保緊急公告至少被看到）
//
// 用法：
//   const { announcement } = useCurrentField() ?? {};
//   <AnnouncementBanner announcement={announcement} />
import { useMemo, useState } from "react";
import { Megaphone, X } from "lucide-react";

interface AnnouncementBannerProps {
  readonly announcement: string | null | undefined;
}

export default function AnnouncementBanner({ announcement }: AnnouncementBannerProps) {
  // 依公告內容 hash 產生 sessionStorage key — 公告改了 key 變，重新顯示
  const dismissKey = useMemo(() => {
    if (!announcement) return null;
    try {
      return `ann_dismissed_${btoa(unescape(encodeURIComponent(announcement))).slice(0, 20)}`;
    } catch {
      return null;
    }
  }, [announcement]);

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissKey) return false;
    try {
      return sessionStorage.getItem(dismissKey) === "1";
    } catch {
      return false;
    }
  });

  if (!announcement || dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (dismissKey) {
      try {
        sessionStorage.setItem(dismissKey, "1");
      } catch {
        /* 某些 sandbox 不讓寫 sessionStorage */
      }
    }
  };

  return (
    <div
      className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 flex items-center justify-center gap-2 text-sm text-amber-700 dark:text-amber-300"
      role="region"
      aria-label="場域公告"
      data-testid="announcement-banner"
    >
      <Megaphone className="w-4 h-4 shrink-0" />
      <span className="text-center leading-relaxed flex-1 max-w-3xl">{announcement}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="shrink-0 text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-300 transition-colors"
        aria-label="關閉公告"
        data-testid="button-dismiss-announcement"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
