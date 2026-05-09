// 🐛 Sentry Server 整合（Phase 1 / 2026-05-10）
//
// 啟用條件：SENTRY_DSN 有設才 init（dev 一般留空、prod 才設）
//
// 設定：
//   - tracesSampleRate 0.1（10% perf trace）
//   - sendDefaultPii false
//   - beforeSend redact 敏感欄位
//
// 自動 capture：
//   - Express middleware error / route handler exception
//   - unhandled promise rejection
//   - uncaught exception
//
// Express 整合：
//   呼叫 setupExpressErrorHandler(app) 在所有 routes 之後、其他 error handler 之前

import * as Sentry from "@sentry/node";
import type { Express } from "express";

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

export function initSentryServer(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // disabled
  initialized = true;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.APP_COMMIT,

    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),

    // 隱私：不送 IP / cookie / 個資
    sendDefaultPii: false,

    beforeSend(event) {
      // redact 敏感欄位
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

    // 過濾已知無害錯誤
    ignoreErrors: [
      "client_disconnect",
      "EPIPE", // ws / http abrupt close
      "ECONNRESET",
      /timeout of \d+ms exceeded/,
    ],
  });

  console.log("[sentry] server enabled (env=" + (process.env.NODE_ENV ?? "dev") + ")");
}

/**
 * 啟用 Express error handler
 * 必須在所有 routes 之後、其他 app error handler 之前
 */
export function setupSentryExpressErrorHandler(app: Express): void {
  if (!initialized) return; // disabled
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry };
