// 📸 AI 結果快取層（Hash-based）
//
// 用途：
//   getCached(taskId, imageUrl, keywords) → 找有沒有相似圖的 cache
//   setCached(...) → AI 真的呼叫後寫入 cache
//   cleanupExpired() → cron 清過期記錄
//
// 命中邏輯：
//   1. 算當前圖片 pHash
//   2. 查同 task_id 的 cache（用 idx_ai_cache_task_phash）
//   3. 對每筆計算 Hamming distance < 5 → 命中
//   4. 命中 hit_count + 1，更新 last_hit_at
//
// TTL：30 天（admin 改任務不影響舊 cache，因為 keywordsHash 變了 cache_key 也變）
import crypto from "crypto";
import { eq, and, sql, lt } from "drizzle-orm";
import { db } from "../db";
import { aiResultCache, type InsertAiResultCache } from "@shared/schema";
import { computeImageHash, hammingDistance } from "./image-hash";

const CACHE_TTL_DAYS = 30;
const PHASH_DISTANCE_THRESHOLD = 5;

/**
 * 從 keywords / context 計算指紋（讓 admin 改設定後 cache 自動失效）
 */
function hashKeywords(input: string | string[]): string {
  const text = Array.isArray(input) ? input.sort().join("|") : input;
  return crypto.createHash("sha256").update(text).digest("hex").substring(0, 16);
}

export interface CacheLookupParams {
  endpoint: "verify-photo" | "compare-photos";
  taskId: string | undefined;
  imageUrl: string;
  /** verify-photo: targetKeywords; compare-photos: referenceImageUrl */
  identityHint: string | string[];
}

export interface CacheHit<T = unknown> {
  hit: true;
  result: T;
  pHash: string;
  distance: number;
  cacheKey: string;
}

export interface CacheMiss {
  hit: false;
  pHash: string | null;
  cacheKey: string | null;
}

/**
 * 查 cache：先算 pHash，再找同 task_id 距離 < 5 的記錄
 */
export async function getCached<T = unknown>(
  params: CacheLookupParams,
): Promise<CacheHit<T> | CacheMiss> {
  // 算 pHash
  const pHash = await computeImageHash(params.imageUrl);
  if (!pHash) {
    return { hit: false, pHash: null, cacheKey: null };
  }

  if (!params.taskId) {
    return { hit: false, pHash, cacheKey: null };
  }

  const keywordsHash = hashKeywords(params.identityHint);
  const exactCacheKey = crypto
    .createHash("sha256")
    .update(`${params.taskId}|${pHash}|${keywordsHash}`)
    .digest("hex")
    .substring(0, 64);

  // 第一層：精確命中（cache_key 完全相同 = 同任務 + 完全相同 pHash + 同 keywords）
  const exact = await db
    .select()
    .from(aiResultCache)
    .where(eq(aiResultCache.cacheKey, exactCacheKey))
    .limit(1);

  if (exact.length > 0 && exact[0].expiresAt > new Date()) {
    // 更新 hit count
    await db
      .update(aiResultCache)
      .set({
        hitCount: sql`${aiResultCache.hitCount} + 1`,
        lastHitAt: new Date(),
      })
      .where(eq(aiResultCache.id, exact[0].id));
    return {
      hit: true,
      result: exact[0].result as T,
      pHash,
      distance: 0,
      cacheKey: exactCacheKey,
    };
  }

  // 第二層：模糊命中（同 task_id + pHash 距離 < 5）
  // 用 idx_ai_cache_task_phash 索引篩 task_id 後在 app 層比對距離
  const candidates = await db
    .select()
    .from(aiResultCache)
    .where(
      and(
        eq(aiResultCache.taskId, params.taskId),
        eq(aiResultCache.endpoint, params.endpoint),
      ),
    )
    .limit(50); // 取 50 筆做距離比對（熱門景點不會太多）

  const now = new Date();
  for (const c of candidates) {
    if (c.expiresAt <= now || !c.pHash) continue;
    const dist = hammingDistance(pHash, c.pHash);
    if (dist < PHASH_DISTANCE_THRESHOLD) {
      // 命中！更新 hit count
      await db
        .update(aiResultCache)
        .set({
          hitCount: sql`${aiResultCache.hitCount} + 1`,
          lastHitAt: now,
        })
        .where(eq(aiResultCache.id, c.id));
      return {
        hit: true,
        result: c.result as T,
        pHash,
        distance: dist,
        cacheKey: c.cacheKey,
      };
    }
  }

  return { hit: false, pHash, cacheKey: exactCacheKey };
}

export interface CacheSetParams {
  endpoint: "verify-photo" | "compare-photos";
  cacheKey: string;
  taskId: string | undefined;
  pHash: string;
  fieldId?: string;
  gameId?: string;
  result: unknown;
}

/**
 * AI 真的呼叫後，把結果寫入 cache（30 天 TTL）
 */
export async function setCached(params: CacheSetParams): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);
  const insert: InsertAiResultCache = {
    cacheKey: params.cacheKey,
    endpoint: params.endpoint,
    taskId: params.taskId ?? null,
    pHash: params.pHash,
    fieldId: params.fieldId ?? null,
    gameId: params.gameId ?? null,
    result: params.result,
    hitCount: 0,
    expiresAt,
  };
  try {
    await db.insert(aiResultCache).values(insert).onConflictDoNothing();
  } catch (err) {
    console.error("[ai-cache] setCached 失敗:", err);
  }
}

/**
 * 清過期 cache（給 cron 用）
 * @returns 刪除的筆數
 */
export async function cleanupExpired(): Promise<number> {
  try {
    const result = await db
      .delete(aiResultCache)
      .where(lt(aiResultCache.expiresAt, new Date()))
      .returning({ id: aiResultCache.id });
    return result.length;
  } catch (err) {
    console.error("[ai-cache] cleanupExpired 失敗:", err);
    return 0;
  }
}

/**
 * 計算 cache 命中率（給 admin 後台 P7 用）
 */
export async function getCacheStats(fieldId?: string): Promise<{
  total: number;
  totalHits: number;
  hitRate: number; // 0-1
}> {
  const rows = fieldId
    ? await db
        .select({
          total: sql<number>`count(*)::int`,
          totalHits: sql<number>`coalesce(sum(${aiResultCache.hitCount}), 0)::int`,
        })
        .from(aiResultCache)
        .where(eq(aiResultCache.fieldId, fieldId))
    : await db
        .select({
          total: sql<number>`count(*)::int`,
          totalHits: sql<number>`coalesce(sum(${aiResultCache.hitCount}), 0)::int`,
        })
        .from(aiResultCache);

  const { total, totalHits } = rows[0] ?? { total: 0, totalHits: 0 };
  const hitRate = total === 0 ? 0 : totalHits / (total + totalHits);
  return { total, totalHits, hitRate };
}

/**
 * 從 keywords/context 算 cache_key（讓呼叫端能在 setCached 前準備好）
 */
export function buildCacheKey(
  taskId: string | undefined,
  pHash: string,
  identityHint: string | string[],
): string {
  if (!taskId) return "";
  const keywordsHash = hashKeywords(identityHint);
  return crypto
    .createHash("sha256")
    .update(`${taskId}|${pHash}|${keywordsHash}`)
    .digest("hex")
    .substring(0, 64);
}
