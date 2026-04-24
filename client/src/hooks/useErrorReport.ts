/**
 * 🛡️ 前端錯誤上報 hook
 *
 * 攔截：
 * - window "error" — 同步 script / resource / uncaught error
 * - window "unhandledrejection" — 未 catch 的 Promise rejection
 * - ErrorBoundary 呼叫的 window.__chitoReportError()
 *
 * 上報 POST /api/error-log（D3 提供）
 *
 * 功能：
 * - Rate limit：最多 10 錯誤/分鐘（避免錯誤爆量淹沒後端）
 * - Deduplication：同一 message+stack 60s 內只送一次
 * - 失敗 fail-silent：上報失敗不能再觸發 error（避免無限迴圈）
 *
 * 用法：在 App.tsx 或 main.tsx 呼叫一次即可
 */
import { useEffect } from "react";

interface ErrorReportPayload {
  message: string;
  stack?: string;
  source: string;
  url?: string;
  userAgent?: string;
  timestamp: string;
}

const MAX_ERRORS_PER_MINUTE = 10;
const DEDUP_WINDOW_MS = 60_000;

// 模組級狀態（單 tab 共用）
const errorTimestamps: number[] = [];
const recentSignatures = new Map<string, number>();

function canReport(signature: string): boolean {
  const now = Date.now();

  // Rate limit: 過去 60 秒最多 10 個
  while (errorTimestamps.length > 0 && now - errorTimestamps[0] > 60_000) {
    errorTimestamps.shift();
  }
  if (errorTimestamps.length >= MAX_ERRORS_PER_MINUTE) return false;

  // Dedup: 同一 signature 在 window 內只送一次
  const lastSeen = recentSignatures.get(signature);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) return false;

  errorTimestamps.push(now);
  recentSignatures.set(signature, now);
  return true;
}

async function sendReport(payload: ErrorReportPayload): Promise<void> {
  try {
    await fetch("/api/error-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(payload),
      // keepalive 讓 unload 前也能送
      keepalive: true,
    });
  } catch {
    // 上報失敗 fail-silent — 不能在 error handler 裡再觸發 error
  }
}

function buildSignature(message: string, stack?: string): string {
  // 取 stack 前幾行作為識別（完整 stack 太長且易變）
  const stackHead = (stack ?? "").split("\n").slice(0, 3).join("|");
  return `${message}::${stackHead}`;
}

/**
 * 掛在 App.tsx 或 main.tsx 的 hook，在元件掛載時註冊全域 error listener。
 * 卸載時清除 listener（避免記憶體洩漏，即使現實中不會卸載）。
 */
export function useErrorReport() {
  useEffect(() => {
    const report = (payload: Omit<ErrorReportPayload, "timestamp" | "url" | "userAgent">) => {
      const sig = buildSignature(payload.message, payload.stack);
      if (!canReport(sig)) return;
      const full: ErrorReportPayload = {
        ...payload,
        url: typeof window !== "undefined" ? window.location.href : undefined,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
      };
      void sendReport(full);
    };

    const handleError = (event: ErrorEvent) => {
      report({
        message: event.message || "Uncaught error",
        stack: event.error?.stack,
        source: "window.error",
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === "string"
          ? reason
          : reason?.message || "Unhandled Promise rejection";
      const stack = reason?.stack;
      report({
        message,
        stack,
        source: "unhandledrejection",
      });
    };

    // 給 ErrorBoundary 用的全域 hook
    (window as unknown as {
      __chitoReportError?: (payload: { message: string; stack?: string; source: string }) => void;
    }).__chitoReportError = report;

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      delete (window as unknown as { __chitoReportError?: unknown }).__chitoReportError;
    };
  }, []);
}
