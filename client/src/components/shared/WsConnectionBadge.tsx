// 🔌 WebSocket 連線狀態 indicator（共用元件）
//
// 設計：
//   - 已連線 → 綠點 + 「即時」（含淡入動畫）
//   - 連線中 → 灰點旋轉 + 「連線中」
//   - 斷線 → 紅點 + 「斷線」+ 點擊重新整理提示（玩家不誤以為 lag）
//
// 使用：固定位置（如 sticky header 角落）
// 設計依據：docs/changes/2026-05-03-error-handling-audit.md Stage 2 #3

import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface WsConnectionBadgeProps {
  /** 是否已連線（從 useTeamWebSocket / useHostScreenSync 等 hook 取得） */
  isConnected: boolean;
  /** 是否正在嘗試連線（剛掛載 / 重連中） */
  isReconnecting?: boolean;
  /** 顯示模式：full=icon+text、compact=只 icon */
  variant?: "full" | "compact";
  /** 自訂 className */
  className?: string;
  /** 錯誤訊息（可選、tooltip / aria-label）*/
  errorMessage?: string | null;
}

export function WsConnectionBadge({
  isConnected,
  isReconnecting = false,
  variant = "full",
  className,
  errorMessage,
}: WsConnectionBadgeProps) {
  // 狀態判斷：已連線 / 連線中 / 斷線
  const status: "connected" | "connecting" | "disconnected" =
    isConnected ? "connected" : isReconnecting ? "connecting" : "disconnected";

  const statusConfig = {
    connected: {
      icon: Wifi,
      text: "即時",
      iconClassName: "text-emerald-500",
      textClassName: "text-emerald-600 dark:text-emerald-400",
    },
    connecting: {
      icon: Loader2,
      text: "連線中",
      iconClassName: "text-zinc-400 animate-spin",
      textClassName: "text-zinc-500",
    },
    disconnected: {
      icon: WifiOff,
      text: "斷線",
      iconClassName: "text-destructive",
      textClassName: "text-destructive",
    },
  } as const;

  const config = statusConfig[status];
  const Icon = config.icon;

  const ariaLabel =
    errorMessage ||
    (status === "connected" ? "即時連線中" :
     status === "connecting" ? "連線中、請稍候" :
     "連線中斷、請檢查網路或重新整理頁面");

  if (variant === "compact") {
    return (
      <div
        className={cn("inline-flex items-center", className)}
        title={ariaLabel}
        aria-label={ariaLabel}
        data-testid={`ws-badge-${status}`}
      >
        <Icon className={cn("w-4 h-4", config.iconClassName)} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 text-xs",
        className,
      )}
      title={ariaLabel}
      aria-label={ariaLabel}
      data-testid={`ws-badge-${status}`}
    >
      <Icon className={cn("w-3.5 h-3.5", config.iconClassName)} />
      <span className={cn("font-medium", config.textClassName)}>
        {config.text}
      </span>
      {/* 斷線時的「重新整理」提示 */}
      {status === "disconnected" && (
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-xs underline text-destructive hover:text-destructive/80 ml-1"
          data-testid="button-ws-reload"
        >
          重新整理
        </button>
      )}
    </div>
  );
}

export default WsConnectionBadge;
