// 全域錯誤邊界元件
// 捕獲 React 渲染錯誤，避免整個應用程式崩潰
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const AUTO_RECOVERY_FLAG = "pwa-auto-recovery-attempted";

/** 偵測是否為「PWA 舊 bundle / SW 快取」造成的錯誤 */
function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return (
    /is not a valid JavaScript MIME type/i.test(msg) ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /ChunkLoadError/i.test(msg) ||
    /Loading chunk .* failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  );
}

/** 清除 Service Worker 與所有 cache，然後重新載入頁面 */
async function clearPwaCachesAndReload(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // 清理失敗不阻止 reload
  }
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // 清理失敗不阻止 reload
  }
  // 強制從 server 拉新版
  window.location.reload();
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo });

    // 🆕 上報錯誤給後端（若 useErrorReport hook 已註冊 __chitoReportError）
    try {
      const w = window as unknown as {
        __chitoReportError?: (payload: { message: string; stack?: string; source: string }) => void;
      };
      if (typeof w.__chitoReportError === "function") {
        w.__chitoReportError({
          message: error.message,
          stack: error.stack,
          source: "ErrorBoundary",
        });
      }
    } catch {
      // 上報失敗不可 block render
    }

    // 若是 chunk / MIME 載入錯誤且尚未嘗試過自動恢復 → 清 SW + cache + reload
    // 用 sessionStorage 避免無限迴圈（若 reload 後還是錯就停止自動恢復，改顯示給使用者）
    if (isChunkLoadError(error)) {
      try {
        const attempted = sessionStorage.getItem(AUTO_RECOVERY_FLAG);
        if (!attempted) {
          sessionStorage.setItem(AUTO_RECOVERY_FLAG, String(Date.now()));
          void clearPwaCachesAndReload();
        }
      } catch {
        // sessionStorage 不可用時直接嘗試恢復
        void clearPwaCachesAndReload();
      }
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  handleForceReload = (): void => {
    void clearPwaCachesAndReload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.state.error && isChunkLoadError(this.state.error);

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                {isChunkError ? "需要更新版本" : "發生錯誤"}
              </h1>
              <p className="text-muted-foreground">
                {isChunkError
                  ? "偵測到版本已更新，請點下方「清除快取重新載入」以取得最新版本。"
                  : "應用程式遇到了一個問題，請嘗試重新整理頁面。"}
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-muted rounded-lg text-left">
                <p className="text-xs text-muted-foreground mb-2">錯誤訊息（請截圖回報）：</p>
                <p className="text-sm font-mono text-destructive break-all">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">技術詳情</summary>
                    <pre className="mt-2 text-xs text-muted-foreground overflow-auto max-h-40">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              <Button variant="outline" onClick={this.handleReset} data-testid="button-err-retry">
                重試
              </Button>
              <Button variant="outline" onClick={this.handleReload} data-testid="button-err-reload">
                <RefreshCw className="w-4 h-4 mr-2" />
                重新整理
              </Button>
              <Button onClick={this.handleForceReload} data-testid="button-err-force-reload">
                <RefreshCw className="w-4 h-4 mr-2" />
                清除快取重新載入
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
