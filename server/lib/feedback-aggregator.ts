// 📊 變體反饋聚合器 — 把 variant_feedback 表的原始紀錄轉成「變體分數」
//
// 用途：
//   - P12 Bandit 抽取時用（依分數加權隨機）
//   - admin 看每個變體的 👍/👎 統計
//   - P11-9 VariantPoolEditor 顯示
//
// 設計：
//   - 純讀（不改資料）
//   - 可選 cache 層（30s TTL，避免每次玩家拍照都打 DB）
//   - score 計算公式：(like - dislike) / max(1, total)，範圍 [-1, 1]
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import { variantFeedback } from "@shared/schema";

export interface VariantScore {
  pageId: string;
  variantKey: string;
  variantIndex: number;
  likeCount: number;
  dislikeCount: number;
  skipCount: number;
  totalFeedback: number;
  /** Wilson lower bound score（讓樣本少的變體不會 outliers） */
  score: number;
  /** 是否被自動隱藏（連續 5 個 dislike 觸發） */
  hidden: boolean;
}

// 簡單 in-memory cache（30s TTL）
const cache = new Map<string, { data: Map<string, VariantScore>; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;

/**
 * 取某 page 所有變體的分數（依 variantKey + variantIndex 為 key）
 *
 * 回傳 Map<"key|index", VariantScore>，方便玩家端 picker 查找
 */
export async function getVariantScores(
  pageId: string,
): Promise<Map<string, VariantScore>> {
  // Cache 查找
  const cached = cache.get(pageId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  // 從 DB aggregate
  const rows = await db
    .select({
      variantKey: variantFeedback.variantKey,
      variantIndex: variantFeedback.variantIndex,
      action: variantFeedback.action,
      cnt: sql<number>`count(*)::int`,
    })
    .from(variantFeedback)
    .where(eq(variantFeedback.pageId, pageId))
    .groupBy(
      variantFeedback.variantKey,
      variantFeedback.variantIndex,
      variantFeedback.action,
    );

  // 整理成 Map
  const scoreMap = new Map<string, VariantScore>();
  for (const r of rows) {
    const key = `${r.variantKey}|${r.variantIndex}`;
    let s = scoreMap.get(key);
    if (!s) {
      s = {
        pageId,
        variantKey: r.variantKey,
        variantIndex: r.variantIndex,
        likeCount: 0,
        dislikeCount: 0,
        skipCount: 0,
        totalFeedback: 0,
        score: 0,
        hidden: false,
      };
      scoreMap.set(key, s);
    }
    if (r.action === "like") s.likeCount = r.cnt;
    else if (r.action === "dislike") s.dislikeCount = r.cnt;
    else if (r.action === "skip") s.skipCount = r.cnt;
  }

  // 計算 score（Wilson lower bound）+ 自動 hidden
  for (const s of Array.from(scoreMap.values())) {
    s.totalFeedback = s.likeCount + s.dislikeCount + s.skipCount;
    s.score = wilsonLowerBound(s.likeCount, s.dislikeCount);
    // 連續 5 個 dislike + 沒 like → 自動隱藏
    s.hidden = s.dislikeCount >= 5 && s.likeCount === 0;
  }

  // 寫 cache
  cache.set(pageId, {
    data: scoreMap,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return scoreMap;
}

/**
 * Wilson Score Lower Bound — 給變體一個「保守的好感度」分數
 *
 * 比 (like - dislike) / total 好的地方：
 *   - 樣本少時不會被誇大（10 like / 0 dislike vs 1 like / 0 dislike）
 *   - 樣本多時收斂到真實比例
 *
 * 範圍 [0, 1]，越高越好（沒反饋預設 0.5 中性）
 */
function wilsonLowerBound(likes: number, dislikes: number): number {
  const n = likes + dislikes;
  if (n === 0) return 0.5; // 沒反饋 = 中性
  const z = 1.96; // 95% 信賴區間
  const phat = likes / n;
  const numerator = phat + (z * z) / (2 * n) - z * Math.sqrt((phat * (1 - phat) + (z * z) / (4 * n)) / n);
  const denominator = 1 + (z * z) / n;
  return numerator / denominator;
}

/**
 * 清快取（admin 修改變體後可以呼叫，立即刷新）
 */
export function invalidateScoresCache(pageId?: string): void {
  if (pageId) {
    cache.delete(pageId);
  } else {
    cache.clear();
  }
}
