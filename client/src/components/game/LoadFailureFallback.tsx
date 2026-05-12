// 🛑 LoadFailureFallback — 統一「資料載入失敗」UI（Phase 3 / 2026-05-12）
//
// 設計：
//   - 給 useQuery isError / 一般 fetch fail 等場景用
//   - 含友善訊息 + 重試 + 跳過按鈕（如有 onSkip）
//   - 自動 report 給 telemetry
//
// 用法：
//   const { data, isError, refetch, error } = useQuery(...);
//   if (isError) return (
//     <LoadFailureFallback
//       title="無法載入隊伍資料"
//       error={error}
//       onRetry={refetch}
//       onSkip={() => onComplete?.({ points: 0 })}
//     />
//   );

import { useEffect } from "react";
import { AlertCircle, RefreshCw, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { reportClientEvent } from "@/lib/event-report";

export interface LoadFailureFallbackProps {
  /** 標題（如「無法載入隊伍資料」）*/
  title?: string;
  /** 描述、可帶 hint */
  description?: string;
  /** 錯誤物件（從 useQuery 來）*/
  error?: unknown;
  /** 重試 callback（通常用 refetch）*/
  onRetry?: () => void;
  /** 跳過 callback（如有、會顯示「跳過」按鈕）*/
  onSkip?: () => void;
  /** 上報 event 名稱（如 "team_load_failure"）*/
  reportEvent?: string;
  /** 上報 context */
  reportContext?: Record<string, unknown>;
}

export default function LoadFailureFallback({
  title = "載入失敗",
  description = "請檢查網路連線、或稍後再試",
  error,
  onRetry,
  onSkip,
  reportEvent,
  reportContext,
}: LoadFailureFallbackProps) {
  // mount 時自動上報
  useEffect(() => {
    if (!reportEvent) return;
    try {
      reportClientEvent({
        event: reportEvent,
        message: (error instanceof Error ? error.message : String(error ?? "load-failure")).slice(0, 200),
        context: reportContext,
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errMessage = error instanceof Error ? error.message : String(error ?? "");

  return (
    <div
      className="h-full w-full flex items-center justify-center p-4"
      data-testid="load-failure-fallback"
    >
      <Card className="w-full max-w-sm border-orange-200 dark:border-orange-800/50">
        <CardContent className="p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-orange-100 dark:bg-orange-950/40 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-base">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          {errMessage && (
            <p className="text-[10px] text-muted-foreground font-mono break-all bg-muted/40 rounded p-2">
              {errMessage.slice(0, 200)}
            </p>
          )}
          <div className="grid gap-2">
            {onRetry && (
              <Button
                onClick={onRetry}
                variant="default"
                className="w-full gap-2"
                data-testid="btn-load-retry"
              >
                <RefreshCw className="w-4 h-4" />
                重試
              </Button>
            )}
            {onSkip && (
              <Button
                onClick={onSkip}
                variant="outline"
                className="w-full gap-2"
                data-testid="btn-load-skip"
              >
                <SkipForward className="w-4 h-4" />
                跳過此題
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
