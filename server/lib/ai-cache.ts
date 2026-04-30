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
import {
  aiResultCache,
  aiCacheArchive,
  fieldExemplarPhotos,
  type InsertAiResultCache,
} from "@shared/schema";
import { computeImageHash, hammingDistance } from "./image-hash";
import { getEffectiveThresholds } from "./threshold-adapter";

const CACHE_TTL_DAYS = 30;
/** P4 預設 pHash 距離閾值（P13 自適應系統會 override） */
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
  /** 玩家原始圖片 URL（P6 cron 策展用） */
  imageUrl?: string;
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
    imageUrl: params.imageUrl ?? null,
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
 * 歸檔過期 cache（取代直接刪除的舊邏輯）
 *
 * 流程：
 *   1. 找 expires_at < NOW() 的 rows
 *   2. 高 confidence ≥ 0.85 + 有 imageUrl 的 → 已在 field_exemplar_photos？沒有則加入
 *   3. 累積統計到 ai_cache_archive（task_id × endpoint UNIQUE，每次 archive 累加）
 *   4. DELETE 原 row（資料已被消化，空間節省）
 *
 * 為什麼這樣做：
 *   - 高分照片 = 玩家成功的視覺證據 → 升級成「精選範本候選」
 *   - 累積使用次數 = 任務熱門度 → admin 在 ai-center 可看
 *   - 平台越用越有歷史資產，符合「自主成長」願景
 *
 * @returns { archived: 歸檔數, exemplarsAdded: 升級到素材庫數, deletedRows: 已刪原 row 數 }
 */
export async function archiveExpired(): Promise<{
  archived: number;
  exemplarsAdded: number;
  deletedRows: number;
}> {
  try {
    // 取所有過期 rows
    const now = new Date();
    const expired = await db
      .select()
      .from(aiResultCache)
      .where(lt(aiResultCache.expiresAt, now));

    if (expired.length === 0) {
      return { archived: 0, exemplarsAdded: 0, deletedRows: 0 };
    }

    let exemplarsAdded = 0;
    let archived = 0;

    // 步驟 2 + 3：分組統計 + 升級高分照片
    // 用 Map<task_id|endpoint, { totalCount, totalHits, sumConfidence, maxConfidence, firstSeen, fieldId, gameId, photos[] }>
    type Group = {
      taskId: string | null;
      endpoint: string;
      fieldId: string | null;
      gameId: string | null;
      totalCount: number;
      totalHits: number;
      sumConfidence: number;
      maxConfidence: number;
      confidenceCount: number;
      firstSeen: Date | null;
      highPhotos: { url: string; confidence: number; pageId: string | null }[];
    };
    const groups = new Map<string, Group>();

    for (const row of expired) {
      const key = `${row.taskId || "null"}|${row.endpoint}`;
      let g = groups.get(key);
      if (!g) {
        g = {
          taskId: row.taskId,
          endpoint: row.endpoint,
          fieldId: row.fieldId,
          gameId: row.gameId,
          totalCount: 0,
          totalHits: 0,
          sumConfidence: 0,
          maxConfidence: 0,
          confidenceCount: 0,
          firstSeen: null,
          highPhotos: [],
        };
        groups.set(key, g);
      }
      g.totalCount++;
      g.totalHits += row.hitCount ?? 0;
      if (row.createdAt && (!g.firstSeen || row.createdAt < g.firstSeen)) {
        g.firstSeen = row.createdAt;
      }
      // 從 result 抽 confidence
      const result = row.result as { confidence?: number; verified?: boolean } | null;
      const conf = typeof result?.confidence === "number" ? result.confidence : null;
      if (conf !== null) {
        g.sumConfidence += conf;
        g.confidenceCount++;
        if (conf > g.maxConfidence) g.maxConfidence = conf;
        // 高分 + 有 imageUrl + verified !== false → 候選素材
        if (conf >= 0.85 && row.imageUrl && result?.verified !== false) {
          g.highPhotos.push({
            url: row.imageUrl,
            confidence: conf,
            pageId: row.taskId,
          });
        }
      }
    }

    // 步驟 2: 升級到 field_exemplar_photos（去重）
    for (const g of Array.from(groups.values())) {
      for (const photo of g.highPhotos) {
        if (!g.fieldId) continue;
        // 去重檢查
        const existing = await db
          .select({ id: fieldExemplarPhotos.id })
          .from(fieldExemplarPhotos)
          .where(
            and(
              eq(fieldExemplarPhotos.photoUrl, photo.url),
              photo.pageId
                ? eq(fieldExemplarPhotos.pageId, photo.pageId)
                : sql`${fieldExemplarPhotos.pageId} IS NULL`,
            ),
          )
          .limit(1);
        if (existing.length > 0) continue;
        try {
          await db.insert(fieldExemplarPhotos).values({
            fieldId: g.fieldId,
            gameId: g.gameId ?? null,
            pageId: photo.pageId ?? null,
            photoUrl: photo.url,
            confidence: photo.confidence.toFixed(2),
            source: "cron_collected",
            isCurated: false,
          });
          exemplarsAdded++;
        } catch (err) {
          console.warn("[ai-cache] 升級 exemplar 失敗:", err instanceof Error ? err.message : err);
        }
      }
    }

    // 步驟 3: 統計 upsert 到 ai_cache_archive
    for (const g of Array.from(groups.values())) {
      const avgConfidence =
        g.confidenceCount > 0 ? g.sumConfidence / g.confidenceCount : null;
      try {
        // PostgreSQL UPSERT (ON CONFLICT DO UPDATE 累加)
        await db
          .insert(aiCacheArchive)
          .values({
            fieldId: g.fieldId,
            gameId: g.gameId,
            taskId: g.taskId,
            endpoint: g.endpoint,
            totalCount: g.totalCount,
            totalHits: g.totalHits,
            avgConfidence: avgConfidence !== null ? avgConfidence.toFixed(3) : null,
            maxConfidence: g.maxConfidence > 0 ? g.maxConfidence.toFixed(3) : null,
            firstSeenAt: g.firstSeen,
            lastArchivedAt: now,
          })
          .onConflictDoUpdate({
            target: [aiCacheArchive.taskId, aiCacheArchive.endpoint],
            set: {
              totalCount: sql`${aiCacheArchive.totalCount} + ${g.totalCount}`,
              totalHits: sql`${aiCacheArchive.totalHits} + ${g.totalHits}`,
              // 加權平均（簡化：用新累加替換）
              avgConfidence:
                avgConfidence !== null ? avgConfidence.toFixed(3) : aiCacheArchive.avgConfidence,
              maxConfidence: sql`GREATEST(COALESCE(${aiCacheArchive.maxConfidence}, 0), ${g.maxConfidence})`,
              lastArchivedAt: now,
            },
          });
        archived++;
      } catch (err) {
        console.warn("[ai-cache] archive upsert 失敗:", err instanceof Error ? err.message : err);
      }
    }

    // 步驟 4: 刪除原 row
    const deleted = await db
      .delete(aiResultCache)
      .where(lt(aiResultCache.expiresAt, now))
      .returning({ id: aiResultCache.id });

    return {
      archived,
      exemplarsAdded,
      deletedRows: deleted.length,
    };
  } catch (err) {
    console.error("[ai-cache] archiveExpired 失敗:", err);
    return { archived: 0, exemplarsAdded: 0, deletedRows: 0 };
  }
}

/**
 * @deprecated 請用 archiveExpired() 取代（保留 alias 不破壞既有 import）
 */
export async function cleanupExpired(): Promise<number> {
  const result = await archiveExpired();
  return result.deletedRows;
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
