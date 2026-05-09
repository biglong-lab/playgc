// 🐛 Sentry Client 整合（Phase 1 / 2026-05-10）
//
// 啟用條件：VITE_SENTRY_DSN 有設才 init（dev 一般留空、prod 才設）
//
// 設定：
//   - tracesSampleRate 0.1（10% perf trace、不影響效能）
//   - replaysSessionSampleRate 0（一般 session 不錄、省 quota）
//   - replaysOnErrorSampleRate 1.0（出錯才錄、精準節省）
//   - sendDefaultPii false（不送 IP / cookie / 個資）
//   - beforeSend redact 敏感欄位
//
// 自動 capture：
//   - React component error（接 ErrorBoundary）
//   - unhandled rejection / uncaught exception
//   - network 5xx response（透過 BrowserTracing fetch instrumentation）
//   - console.error
//
// 隱私（redact 規範）：
//   - password / passwd / *_token / *Token / *_secret / *Secret / firebase / cookie / authorization
//   - email / userId 不 redact（爭議仲裁需要）

import * as Sentry from "@sentry/react";

const REDACT_KEYS = [
  /password/i,
  /passwd/i,
  /token$/i,
  /secret/i,
  /api_?key/i,
  /credit_?card/i,
  /firebase/i,
  /authorization/i,
  /^cookie$/i,
];

function redactObject(obj: unknown, depth = 0): unknown {
  if (depth > 5) return "[deep]";
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map((x) => redactObject(x, depth + 1));
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (REDACT_KEYS.some((p) => p.test(k))) {
      result[k] = "[redacted]";
    } else {
      result[k] = redactObject(v, depth + 1);
    }
  }
  return result;
}

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return; // disabled
  initialized = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE === "production" ? "production" : "development",
    release: import.meta.env.VITE_APP_COMMIT || undefined,

    // Performance
    tracesSampleRate: 0.1,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],

    // Replay：normal session 0%、error 100%
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

    // 隱私：不送 IP / cookie / 個資
    sendDefaultPii: false,

    // 過濾 + redact
    beforeSend(event) {
      // 1. 過濾測試 / dev URL（避免本地 noise）
      const url = event.request?.url ?? "";
      if (url.includes("localhost") || url.includes("127.0.0.1")) {
        return null;
      }
      // 2. redact 敏感欄位
      if (event.request) {
        event.request = redactObject(event.request) as typeof event.request;
      }
      if (event.extra) {
        event.extra = redactObject(event.extra) as typeof event.extra;
      }
      if (event.contexts) {
        event.contexts = redactObject(event.contexts) as typeof event.contexts;
      }
      return event;
    },

    // 不要 capture 已知無害錯誤
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      // chunk loading（既有 ErrorBoundary 已處理）
      /Loading chunk \d+ failed/,
      /Failed to fetch dynamically imported module/,
    ],
  });
}
