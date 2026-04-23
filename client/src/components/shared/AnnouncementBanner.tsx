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
import { useMemo, useState, type ReactNode } from "react";
import { Megaphone, AlertCircle, X } from "lucide-react";

/**
 * 🆕 將公告文字中的 https:// URL 轉為 clickable 連結
 *
 * 安全性：
 *   - 只認 https://（不接受 http、javascript: 等）
 *   - rel="noopener noreferrer" 防 tabnabbing
 *   - 不用 dangerouslySetInnerHTML，用 React 元素組合避免 XSS
 */
function linkifyAnnouncement(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // 匹配 https://...（到空白或字串結尾）
  const regex = /(https:\/\/[^\s<>"']+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 移除 URL 結尾可能的標點（中文常見全形 。，、！？）
    let url = match[0];
    const trailing = url.match(/[。，、！？,.!?]+$/)?.[0];
    if (trailing) {
      url = url.slice(0, -trailing.length);
    }
    parts.push(
      <a
        key={`link-${match.index}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:no-underline font-medium break-all"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    if (trailing) parts.push(trailing);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : [text];
}

export type AnnouncementSeverity = "info" | "urgent";

interface AnnouncementBannerProps {
  readonly announcement: string | null | undefined;
  /** 🆕 嚴重程度：info 琥珀可關 / urgent 紅色不可關（預設 info） */
  readonly severity?: AnnouncementSeverity;
}

/** 🆕 嚴重程度配色 + icon */
const SEVERITY_STYLES: Record<AnnouncementSeverity, {
  wrapper: string;
  closeBtn: string;
  Icon: React.ComponentType<{ className?: string }>;
  ariaRole: "region" | "alert";
}> = {
  info: {
    wrapper:
      "bg-amber-500/10 border-b border-amber-500/30 text-amber-700 dark:text-amber-300",
    closeBtn:
      "text-amber-600/70 hover:text-amber-700 dark:text-amber-400/70 dark:hover:text-amber-300",
    Icon: Megaphone,
    ariaRole: "region",
  },
  urgent: {
    wrapper:
      "bg-red-500/10 border-b-2 border-red-500/50 text-red-700 dark:text-red-300 font-medium",
    closeBtn: "",
    Icon: AlertCircle,
    ariaRole: "alert",
  },
};

export default function AnnouncementBanner({
  announcement,
  severity = "info",
}: AnnouncementBannerProps) {
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

  if (!announcement) return null;
  // urgent 不可關，info 被關則隱藏
  if (severity === "info" && dismissed) return null;

  const style = SEVERITY_STYLES[severity];
  const Icon = style.Icon;

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
      className={`px-4 py-2.5 flex items-center justify-center gap-2 text-sm ${style.wrapper}`}
      role={style.ariaRole}
      aria-label="場域公告"
      data-testid="announcement-banner"
      data-severity={severity}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-center leading-relaxed flex-1 max-w-3xl">
        {formatAnnouncement(announcement)}
      </span>
      {severity === "info" && (
        <button
          type="button"
          onClick={handleDismiss}
          className={`shrink-0 transition-colors ${style.closeBtn}`}
          aria-label="關閉公告"
          data-testid="button-dismiss-announcement"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
