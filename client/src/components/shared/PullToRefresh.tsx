// 📲 PullToRefresh — 下拉重整 wrapper 元件
// 2026-05-09：PWA 體感優化
//
// 用法：
//   <PullToRefresh onRefresh={handleRefresh}>
//     <YourPageContent />
//   </PullToRefresh>
//
// 設計：
//   - 不改 layout：children 不會被 transform，body 維持原本滾動
//   - Indicator 用 fixed 浮在頂部、依拉動距離淡入
//   - 達 threshold 時箭頭旋轉 + 文案切換
//   - safe-area 自動處理（iOS 瀏海下方）
//   - enabled 可動態切換（遊戲進行中傳 false）

import type { ReactNode } from "react";
import { ArrowDown, Loader2 } from "lucide-react";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface PullToRefreshProps {
  children: ReactNode;
  /** 重整 callback（呼叫端負責執行 refetch + toast）*/
  onRefresh: () => Promise<void> | void;
  /** 是否啟用（預設 true）— 遊戲進行中或 modal 開啟時應傳 false */
  enabled?: boolean;
  /** indicator 文案客製化 */
  pullText?: string;
  releaseText?: string;
  refreshingText?: string;
}

export default function PullToRefresh({
  children,
  onRefresh,
  enabled = true,
  pullText = "下拉重整",
  releaseText = "放開以重整",
  refreshingText = "重整中...",
}: PullToRefreshProps) {
  const { isPulling, pullDistance, isRefreshing, isAtThreshold } = usePullToRefresh({
    onRefresh,
    enabled,
  });

  const showIndicator = isPulling || isRefreshing;
  const text = isRefreshing ? refreshingText : isAtThreshold ? releaseText : pullText;

  return (
    <>
      {/* Indicator — fixed 浮在頂部，配合 safe-area-inset-top 避開瀏海 */}
      <div
        aria-hidden={!showIndicator}
        className="pointer-events-none fixed left-0 right-0 z-50 flex items-center justify-center"
        style={{
          top: "env(safe-area-inset-top)",
          height: 60,
          // 用 transform 跟著拉動距離移動（最多 60px）
          transform: `translateY(${Math.max(0, Math.min(60, pullDistance) - 60)}px)`,
          opacity: showIndicator ? Math.min(1, pullDistance / 40) : 0,
          transition: isPulling
            ? "none"
            : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease",
        }}
      >
        <div className="flex items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-lg backdrop-blur-sm">
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowDown
              className={`h-4 w-4 transition-transform duration-200 ${
                isAtThreshold ? "rotate-180" : ""
              }`}
            />
          )}
          <span>{text}</span>
        </div>
      </div>

      {children}
    </>
  );
}
