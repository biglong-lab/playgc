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

/**
 * 啟用 Express error handler（Sentry init 由 server/instrument.ts 處理）
 * 必須在所有 routes 之後、其他 app error handler 之前呼叫
 *
 * SENTRY_DSN 留空時、Sentry SDK 仍會初始化但不送資料（safe no-op）
 */
export function setupSentryExpressErrorHandler(app: Express): void {
  if (!process.env.SENTRY_DSN) return; // disabled
  Sentry.setupExpressErrorHandler(app);
}

export { Sentry, redactObject };
