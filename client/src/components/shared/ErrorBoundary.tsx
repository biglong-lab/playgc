/**
 * 🛡️ 全站 ErrorBoundary
 * 攔截 React render tree 中未處理的 exception，顯示 fallback UI。
 * 包在 main.tsx 最外層，所有 provider 都在裡面。
 *
 * 注意：ErrorBoundary 只能攔 render error；非同步 / event handler 錯誤由 useErrorReport 處理。
 */
import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
  /** 可選的 fallback — 未提供則用預設 UI */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錯誤到 console（之後 D2 hook 會送到後端）
    console.error("[ErrorBoundary] React render 發生未捕捉錯誤：", error, errorInfo);

    // 若全域有錯誤上報 hook（D2 提供）就呼叫
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
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <div
          className="min-h-screen bg-background flex items-center justify-center p-4"
          data-testid="error-boundary-fallback"
        >
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-display font-bold mb-2">頁面發生錯誤</h2>
            <p className="text-sm text-muted-foreground mb-1">
              抱歉，此頁面暫時無法顯示。您可以重新載入或返回首頁。
            </p>
            {/* 開發模式額外顯示錯誤訊息 */}
            {import.meta.env.DEV && (
              <pre className="text-xs text-left bg-muted p-3 rounded mt-4 overflow-auto max-h-40 font-mono">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                onClick={() => window.location.reload()}
                className="gap-1.5"
                data-testid="btn-error-reload"
              >
                <RefreshCcw className="w-4 h-4" />
                重新載入
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  this.reset();
                  window.location.href = "/";
                }}
                className="gap-1.5"
                data-testid="btn-error-home"
              >
                <Home className="w-4 h-4" />
                回首頁
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
