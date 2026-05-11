// 🛡️ ComponentErrorBoundary — 元件級錯誤隔離（Phase 2 / 2026-05-12）
//
// 設計：
//   - 每個遊戲元件包獨立 ErrorBoundary、單個元件 throw 不影響其他元件
//   - 錯誤時顯示友善 UI：跳過 / 重試 / 回報
//   - 自動 report telemetry（component_runs.finalState=errored）
//   - 自動 report client_event（給 Sentry / observability log）
//
// 用法：
//   <ComponentErrorBoundary
//     componentType="trivia_showdown"
//     sessionId={sessionId}
//     onSkip={() => onComplete({ points: 0 }, undefined)}
//   >
//     <TriviaShowdownPage ... />
//   </ComponentErrorBoundary>
//
// 注意：React ErrorBoundary 必須是 class component

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, SkipForward, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { reportClientEvent } from "@/lib/event-report";

interface Props {
  /** 元件類型（如 "trivia_showdown" / "gps_mission"）給 telemetry / logging 用 */
  componentType: string;
  /** session id（如有）給 debug log 用 */
  sessionId?: string | null;
  /** page id（如有）給 debug log 用 */
  pageId?: string | null;
  /** 玩家點「跳過此題」呼叫（通常呼叫 onComplete({ points: 0 })）*/
  onSkip?: () => void;
  /** 錯誤觸發時 callback（給 Phase 1 telemetry hook 標記 errored 用）*/
  onError?: (error: Error) => void;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorKey: number;
}

export class ComponentErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    error: null,
    errorKey: 0,
  };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const { componentType, sessionId, pageId, onError } = this.props;

    // 自動 report 到 observability（既有 reportClientEvent 走 /api/error-log + dedup）
    try {
      reportClientEvent({
        event: `component_error_${componentType}`,
        message: error.message?.slice(0, 500) ?? "unknown",
        context: {
          componentType,
          sessionId,
          pageId,
          stack: error.stack?.slice(0, 2000),
          componentStack: errorInfo.componentStack?.slice(0, 2000),
        },
      });
    } catch {
      /* report 失敗不阻塞 */
    }

    // 通知父層（Phase 1 telemetry 用）
    try {
      onError?.(error);
    } catch {
      /* ignore */
    }

    console.error(`[ComponentErrorBoundary:${componentType}]`, error);
  }

  private handleRetry = () => {
    this.setState((s) => ({ hasError: false, error: null, errorKey: s.errorKey + 1 }));
  };

  private handleSkip = () => {
    try {
      this.props.onSkip?.();
    } catch (err) {
      console.error("[ComponentErrorBoundary] onSkip threw:", err);
    }
  };

  private handleReport = () => {
    // 開新分頁送回報（不打擾當前 game flow）
    const subject = encodeURIComponent(`遊戲元件錯誤回報：${this.props.componentType}`);
    const body = encodeURIComponent(
      `元件: ${this.props.componentType}\n` +
        `Session: ${this.props.sessionId ?? "-"}\n` +
        `頁面: ${this.props.pageId ?? "-"}\n` +
        `錯誤: ${this.state.error?.message ?? "-"}\n` +
        `時間: ${new Date().toLocaleString("zh-TW")}\n` +
        `\n請描述出錯前的操作：\n`,
    );
    window.open(`mailto:support@homi.cc?subject=${subject}&body=${body}`, "_blank");
  };

  render() {
    if (!this.state.hasError) {
      // 用 errorKey 強制 unmount + remount 子元件（重試）
      return <div key={this.state.errorKey}>{this.props.children}</div>;
    }

    return (
      <div className="h-full w-full flex items-center justify-center p-4" data-testid="component-error-boundary">
        <Card className="w-full max-w-md border-orange-200 dark:border-orange-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="w-5 h-5" />
              元件暫時無法使用
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              這個元件遇到問題、不影響整場遊戲。你可以：
            </p>
            <div className="text-xs bg-muted/50 rounded p-2 font-mono break-all">
              {this.state.error?.message?.slice(0, 200) ?? "未知錯誤"}
            </div>
            <div className="grid gap-2">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="w-full gap-2"
                data-testid="btn-error-retry"
              >
                <RefreshCw className="w-4 h-4" />
                重試
              </Button>
              {this.props.onSkip && (
                <Button
                  onClick={this.handleSkip}
                  variant="outline"
                  className="w-full gap-2"
                  data-testid="btn-error-skip"
                >
                  <SkipForward className="w-4 h-4" />
                  跳過此題、繼續遊戲
                </Button>
              )}
              <Button
                onClick={this.handleReport}
                variant="ghost"
                size="sm"
                className="w-full gap-2 text-muted-foreground"
                data-testid="btn-error-report"
              >
                <MessageSquare className="w-3 h-3" />
                回報問題
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">
              系統已自動紀錄此問題、開發團隊會盡快處理
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
}

export default ComponentErrorBoundary;
