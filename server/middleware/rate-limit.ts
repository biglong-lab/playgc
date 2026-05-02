// 🚦 Rate Limit Middleware — Public API 速率限制（W11 D2）
//
// 設計：sliding window in-memory（每 key 每 60s 60 req）
// 限制：重啟 process 後重新計算（可接受）
// 未來：W12 換 Redis 跨 process 同步
//
// 設計依據：docs/decisions/0008-public-api-design.md

import type { Request, Response, NextFunction } from "express";

const WINDOW_MS = 60 * 1000; // 60 秒
const MAX_REQUESTS_PER_MINUTE = 60;

// key → 該 key 在 window 內的請求 timestamps
const requestLog = new Map<string, number[]>();

// 每 5 分鐘清理過期 entries
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const entries = Array.from(requestLog.entries());
  for (const [key, timestamps] of entries) {
    const recent = timestamps.filter((t: number) => now - t < WINDOW_MS);
    if (recent.length === 0) {
      requestLog.delete(key);
    } else {
      requestLog.set(key, recent);
    }
  }
}

/**
 * Rate limit middleware（每 API key 60 req/min）
 *
 * 必須放在 requireApiKey 之後（依賴 req.apiKey.keyId）
 *
 * 失敗回應：
 *   429 + Retry-After header（秒）
 *   error.code: "rate_limit_exceeded"
 */
export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const keyId = req.apiKey?.keyId;
  if (!keyId) {
    // 不該發生（middleware 順序錯）
    return res.status(500).json({
      error: { code: "internal_error", message: "rateLimit 必須在 requireApiKey 之後" },
    });
  }

  const now = Date.now();
  cleanup(now);

  const timestamps = requestLog.get(keyId) ?? [];
  // 過濾掉超過 window 的舊紀錄
  const recent = timestamps.filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_MINUTE) {
    // 計算 Retry-After（最早的一個 timestamp 過期時間）
    const oldest = Math.min(...recent);
    const retryAfterSec = Math.ceil((oldest + WINDOW_MS - now) / 1000);

    res.setHeader("Retry-After", String(retryAfterSec));
    res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS_PER_MINUTE));
    res.setHeader("X-RateLimit-Remaining", "0");
    res.setHeader("X-RateLimit-Reset", String(Math.ceil((oldest + WINDOW_MS) / 1000)));

    return res.status(429).json({
      error: {
        code: "rate_limit_exceeded",
        message: `每分鐘最多 ${MAX_REQUESTS_PER_MINUTE} 個請求，請等 ${retryAfterSec} 秒後重試`,
        retryAfterSeconds: retryAfterSec,
      },
    });
  }

  // 通過 → 記錄 + 設 header
  recent.push(now);
  requestLog.set(keyId, recent);

  res.setHeader("X-RateLimit-Limit", String(MAX_REQUESTS_PER_MINUTE));
  res.setHeader("X-RateLimit-Remaining", String(MAX_REQUESTS_PER_MINUTE - recent.length));

  next();
}
