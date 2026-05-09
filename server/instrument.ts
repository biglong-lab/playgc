// 🐛 Sentry instrument — 必須在所有其他 import 之前執行（Sentry v10 規範）
//
// 對應 server/index.ts 第一行：import "./instrument";
//
// Sentry 10.x 需要在 require/import express 之前 init、否則無法 instrument
// auto instrumentation（http/express/postgres）+ 完整 perf trace 仰賴此檔最早載入
//
// 啟用條件：SENTRY_DSN 有設才 init
// （留空 → 整個 file 是 no-op、不影響啟動）

import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.APP_COMMIT,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.1"),
    sendDefaultPii: false,

    beforeSend(event) {
      // 簡化 redact（完整 redact 由 server/lib/sentry.ts 之 captureException 等手動 path 處理）
      const REDACT = /password|token$|secret|api_?key|firebase|authorization|^cookie$/i;
      const walk = (obj: unknown, depth = 0): unknown => {
        if (depth > 5 || obj === null || typeof obj !== "object") return obj;
        if (Array.isArray(obj)) return obj.map((x) => walk(x, depth + 1));
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          out[k] = REDACT.test(k) ? "[redacted]" : walk(v, depth + 1);
        }
        return out;
      };
      if (event.request) event.request = walk(event.request) as typeof event.request;
      if (event.extra) event.extra = walk(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = walk(event.contexts) as typeof event.contexts;
      return event;
    },

    ignoreErrors: [
      "client_disconnect",
      "EPIPE",
      "ECONNRESET",
      /timeout of \d+ms exceeded/,
    ],
  });

  console.log("[sentry] server instrumented (env=" + (process.env.NODE_ENV ?? "dev") + ")");
}
