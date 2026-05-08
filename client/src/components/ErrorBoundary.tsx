// 全域錯誤邊界元件
// 捕獲 React 渲染錯誤，避免整個應用程式崩潰
import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, Copy, Check } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  /** 複製錯誤資訊狀態（給回報用、Stage 3 #8） */
  copied: boolean;
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

/** 偵測是否為「React minified error」— production 部署後常見、通常表示
 *  client 拿到舊 chunk 但 server 已部署新版（hook 順序變化、props 結構變動等）
 *  常見編號：
 *    #310 — Rendered more hooks than during the previous render
 *    #185 — Maximum update depth exceeded
 *    #418/#423/#425 — Hydration mismatch
 *  → 跟 chunk error 一樣自動清快取 reload
 *
 *  🆕 D2-c+ (2026-05-09)
 */
function isReactMinifiedError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /Minified React error #\d+/i.test(msg);
}

/** 一個錯誤值得自動清快取 reload */
function shouldAutoRecover(error: Error): boolean {
  return isChunkLoadError(error) || isReactMinifiedError(error);
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
      copied: false,
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
      copied: false,
    });
  };

  /** 複製錯誤資訊（給玩家回報、Stage 3 #8）
   *  包含 message + URL + UA + timestamp + componentStack（前 10 行）
   */
  handleCopyReport = async (): Promise<void> => {
    const err = this.state.error;
    const errInfo = this.state.errorInfo;
    if (!err) return;

    const lines = [
      `【錯誤回報】`,
      `時間：${new Date().toISOString()}`,
      `頁面：${typeof window !== "undefined" ? window.location.href : "unknown"}`,
      `錯誤：${err.name}: ${err.message}`,
      "",
      `── 技術資訊（請保留給工程師）──`,
      `User-Agent：${typeof navigator !== "undefined" ? navigator.userAgent : "unknown"}`,
      err.stack ? `Stack：\n${err.stack.split("\n").slice(0, 10).join("\n")}` : "",
      errInfo?.componentStack
        ? `Component：${errInfo.componentStack.split("\n").slice(0, 5).join("\n")}`
        : "",
    ].filter(Boolean);

    const text = lines.join("\n");

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        // fallback：用 textarea 複製（HTTP / 老 browser）
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // fail-silent — 不能在 ErrorBoundary 內再 throw
    }
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
        <div className="min-h-screen-dynamic bg-background flex items-center justify-center p-4">
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

            {/* 🆕 複製錯誤資訊回報（Stage 3 #8）— 比「請截圖」更友善 + 工程師可貼上 */}
            {this.state.error && (
              <div className="pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={this.handleCopyReport}
                  data-testid="button-err-copy-report"
                  className="gap-2"
                >
                  {this.state.copied ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      已複製、可貼給工程師
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      複製錯誤資訊回報
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
