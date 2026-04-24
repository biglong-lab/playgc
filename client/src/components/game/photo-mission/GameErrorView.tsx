// ⚠️ 共用錯誤畫面 — 讓錯誤狀態不再隱晦、有明確下一步
//
// 設計原則：
//   - 告訴使用者「發生什麼事」（不能只說「失敗」）
//   - 告訴使用者「能做什麼」（至少兩個選項：重試 / 跳過）
//   - 避免死鎖（一定有 onSkip 讓遊戲繼續）

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface GameErrorViewProps {
  /** 主標題，簡潔描述錯誤 */
  title: string;
  /** 具體原因 */
  message?: string;
  /** 建議動作文字 */
  hint?: string;
  /** 重試回調（未提供則不顯示重試鈕）*/
  onRetry?: () => void;
  /** 跳過回調（必須）— 避免死鎖 */
  onSkip: () => void;
  /** 跳過按鈕文字 */
  skipLabel?: string;
  testId?: string;
}

export default function GameErrorView({
  title,
  message,
  hint,
  onRetry,
  onSkip,
  skipLabel = "跳過此關",
  testId = "game-error-view",
}: GameErrorViewProps) {
  return (
    <div
      className="w-full min-h-full overflow-y-auto bg-background"
      data-testid={testId}
    >
      <div className="max-w-md mx-auto px-4 py-6 flex flex-col items-center gap-4">
        {/* 警告 icon */}
        <AlertTriangle className="w-16 h-16 text-amber-500" />

        {/* 標題 */}
        <h2 className="text-xl font-bold text-center">{title}</h2>

        {/* 具體訊息 */}
        {message && (
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {message}
          </p>
        )}

        {/* 提示 */}
        {hint && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300 max-w-sm">
            💡 {hint}
          </div>
        )}

        {/* 操作按鈕 */}
        <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
          {onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="flex-1 gap-2"
              data-testid="btn-game-error-retry"
            >
              <RefreshCw className="w-4 h-4" /> 再試一次
            </Button>
          )}
          <Button
            onClick={onSkip}
            className={onRetry ? "flex-1" : "w-full"}
            data-testid="btn-game-error-skip"
          >
            {skipLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
