// 🛡️ 遊戲頁面錯誤邊界 — 防止單一頁面 React crash 導致整個遊戲死鎖
//
// 為什麼需要？
//   - 相機元件、MediaPipe、Canvas 合成任一處拋 exception → 整頁白屏
//   - 玩家只能關閉 App 重開，進度可能遺失
//   - 有 ErrorBoundary 就可以 catch → 顯示友善錯誤 + 跳過此關
//
// 使用方式：GamePlay.tsx 包住 <GamePageRenderer />
import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** 玩家點「跳過此關」的回調 */
  onSkip?: () => void;
  /** 頁面類型（用於錯誤日誌）*/
  pageType?: string;
}

interface State {
  error: Error | null;
}

export default class GamePageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // 上報到 client logger（若可用）
    console.error("[GamePageErrorBoundary]", this.props.pageType, error, errorInfo);
    // 非同步上報，避免阻塞
    import("@/lib/clientLogger")
      .then(({ logError }) => {
        logError("game", "page_crash", error, {
          pageType: this.props.pageType,
          componentStack: errorInfo.componentStack?.slice(0, 500),
        });
      })
      .catch(() => {
        /* logger 載入失敗不影響主流程 */
      });
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="w-full min-h-full overflow-y-auto bg-background"
          data-testid="game-page-error-boundary"
        >
          <div className="max-w-md mx-auto px-4 py-8 flex flex-col items-center gap-4">
            <AlertTriangle className="w-16 h-16 text-amber-500" />

            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">這一關有點問題</h2>
              <p className="text-sm text-muted-foreground">
                頁面載入失敗，但別擔心，你的進度都保留著。
              </p>
            </div>

            {/* 錯誤詳情（可折疊）*/}
            <details className="w-full bg-muted/30 rounded-lg p-3 text-xs text-muted-foreground">
              <summary className="cursor-pointer font-medium">
                技術細節（回報問題用）
              </summary>
              <pre className="mt-2 whitespace-pre-wrap break-all text-[10px]">
                {this.props.pageType && `頁面類型: ${this.props.pageType}\n`}
                {this.state.error.message}
              </pre>
            </details>

            <div className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <Button
                onClick={this.handleRetry}
                variant="outline"
                className="flex-1 gap-2"
                data-testid="btn-game-error-retry-page"
              >
                <RefreshCw className="w-4 h-4" /> 重新載入
              </Button>
              {this.props.onSkip && (
                <Button
                  onClick={this.props.onSkip}
                  className="flex-1"
                  data-testid="btn-game-error-skip-page"
                >
                  跳過此關繼續
                </Button>
              )}
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              💡 若重複發生，請截圖給管理員
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
