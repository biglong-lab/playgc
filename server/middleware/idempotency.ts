// 🔁 Idempotency Middleware — Idempotency-Key header 處理（W11 D2）
//
// 設計：
//   POST endpoint 可加 Idempotency-Key header
//   24 小時內相同 key 重發 → 直接回傳第一次的結果
//   避免代理商網路重試導致重複建場
//
// In-memory cache：
//   key → { status, body }（24 小時 TTL）
//   重啟 process 後重新計算（可接受、未來換 Redis）

import type { Request, Response, NextFunction } from "express";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 小時

interface CachedResponse {
  status: number;
  body: unknown;
  cachedAt: number;
  apiKeyId: string;
}

const cache = new Map<string, CachedResponse>();

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 每 1 小時清理
let lastCleanup = Date.now();

function cleanup(now: number): void {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  const entries = Array.from(cache.entries());
  for (const [key, entry] of entries) {
    if (now - entry.cachedAt > CACHE_TTL_MS) {
      cache.delete(key);
    }
  }
}

/**
 * Idempotency middleware
 *
 * 使用方式：
 *   app.post("/api/v1/instances", requireApiKey, idempotency, async (req, res) => {
 *     // ... 正常邏輯
 *     res.json({...}); // idempotency middleware 會自動 cache
 *   });
 *
 * 規則：
 *   - 沒帶 Idempotency-Key header → 略過 cache、正常處理
 *   - 帶了且 cache hit → 直接回 cached response（不執行 handler）
 *   - 帶了且 cache miss → 執行 handler、cache 結果
 *   - 不同 API key 用同一個 idempotency key → 視為不同請求（隔離）
 */
export function idempotency(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
  if (!idempotencyKey) return next();

  const apiKeyId = req.apiKey?.keyId ?? "anonymous";
  const cacheKey = `${apiKeyId}:${idempotencyKey}`;

  const now = Date.now();
  cleanup(now);

  const cached = cache.get(cacheKey);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    res.setHeader("Idempotent-Replay", "true");
    return res.status(cached.status).json(cached.body);
  }

  // cache miss → patch res.json 收集結果
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    cache.set(cacheKey, {
      status: res.statusCode,
      body,
      cachedAt: now,
      apiKeyId,
    });
    res.setHeader("Idempotent-Replay", "false");
    return originalJson(body);
  }) as typeof res.json;

  next();
}
