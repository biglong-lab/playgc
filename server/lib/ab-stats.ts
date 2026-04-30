// 🔬 A/B 測試統計顯著性
//
// 用途：給定一個實驗 ID，分析兩組玩家的「滿意度」差異是否顯著
//
// 演算法：Two-proportion z-test
//   H0: pA = pB（兩組沒差異）
//   H1: pA ≠ pB
//   z = (pA - pB) / sqrt(p_pool × (1-p_pool) × (1/nA + 1/nB))
//   |z| > z_α/2 → 拒絕 H0 → 有差異
//
// 結論判定：
//   - p-value < significance_level（預設 0.05）
//     → 看哪組 rate 較高 → 'a_wins' / 'b_wins'
//   - p-value ≥ significance_level → 'no_difference'
//   - 樣本不足 → 'insufficient_data'
//
// 滿意度指標：
//   - 取 ab_assignments 中該實驗的玩家
//   - 對應 variant_feedback 中對 page+variantKey+index 的 like 數
//   - rate = likes / total_assignments

import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  abExperiments,
  abAssignments,
  variantFeedback,
  type AbConclusion,
} from "@shared/schema";

export interface AbStatistics {
  experimentId: string;
  groupA: {
    assignments: number;
    likes: number;
    dislikes: number;
    rate: number; // likes / max(assignments, 1)
  };
  groupB: {
    assignments: number;
    likes: number;
    dislikes: number;
    rate: number;
  };
  pValue: number;
  zStatistic: number;
  effectSize: number; // |rateA - rateB|
  totalAssignments: number;
  conclusion: AbConclusion;
  conclusionReason: string;
}

/**
 * 計算實驗統計顯著性
 */
export async function calculateSignificance(
  experimentId: string,
): Promise<AbStatistics> {
  // 取實驗 metadata
  const [exp] = await db
    .select()
    .from(abExperiments)
    .where(eq(abExperiments.id, experimentId))
    .limit(1);

  if (!exp) {
    throw new Error(`實驗 ${experimentId} 不存在`);
  }

  const minRequired = exp.minAssignmentsForConclusion ?? 50;
  const sigLevel = parseFloat(exp.significanceLevel ?? "0.05");

  // 取兩組分組數 + 對應 like/dislike 統計
  // A 組：variant_a_index 的反饋；B 組：variant_b_index 的反饋
  const stats = await Promise.all([
    fetchGroupStats(experimentId, "a", exp.targetPageId, exp.targetVariantKey, exp.variantAIndex),
    fetchGroupStats(experimentId, "b", exp.targetPageId, exp.targetVariantKey, exp.variantBIndex),
  ]);

  const groupA = stats[0];
  const groupB = stats[1];
  const totalAssignments = groupA.assignments + groupB.assignments;

  // 樣本不足
  if (totalAssignments < minRequired) {
    return {
      experimentId,
      groupA,
      groupB,
      pValue: 1,
      zStatistic: 0,
      effectSize: Math.abs(groupA.rate - groupB.rate),
      totalAssignments,
      conclusion: "insufficient_data",
      conclusionReason: `總分組 ${totalAssignments} < 最少需求 ${minRequired}`,
    };
  }

  // 任一組無分組 → 無法比較
  if (groupA.assignments === 0 || groupB.assignments === 0) {
    return {
      experimentId,
      groupA,
      groupB,
      pValue: 1,
      zStatistic: 0,
      effectSize: 0,
      totalAssignments,
      conclusion: "insufficient_data",
      conclusionReason: "其中一組無玩家分組",
    };
  }

  // 計算 z-statistic + p-value
  const { zStatistic, pValue } = twoProportionZTest(
    groupA.likes,
    groupA.assignments,
    groupB.likes,
    groupB.assignments,
  );

  const effectSize = Math.abs(groupA.rate - groupB.rate);

  // 判定結論
  let conclusion: AbConclusion;
  let conclusionReason: string;
  if (pValue < sigLevel) {
    if (groupA.rate > groupB.rate) {
      conclusion = "a_wins";
      conclusionReason = `A 組勝出（${(groupA.rate * 100).toFixed(1)}% vs ${(groupB.rate * 100).toFixed(1)}%, p=${pValue.toFixed(4)}）`;
    } else {
      conclusion = "b_wins";
      conclusionReason = `B 組勝出（${(groupB.rate * 100).toFixed(1)}% vs ${(groupA.rate * 100).toFixed(1)}%, p=${pValue.toFixed(4)}）`;
    }
  } else {
    conclusion = "no_difference";
    conclusionReason = `兩組無顯著差異（p=${pValue.toFixed(4)} ≥ ${sigLevel}）`;
  }

  return {
    experimentId,
    groupA,
    groupB,
    pValue,
    zStatistic,
    effectSize,
    totalAssignments,
    conclusion,
    conclusionReason,
  };
}

/**
 * 取單組（A 或 B）的統計
 */
async function fetchGroupStats(
  experimentId: string,
  group: "a" | "b",
  pageId: string | null,
  variantKey: string | null,
  variantIndex: number | null,
): Promise<{
  assignments: number;
  likes: number;
  dislikes: number;
  rate: number;
}> {
  // 1. 取此組所有 user_id
  const assignedUsers = await db
    .select({ userId: abAssignments.userId })
    .from(abAssignments)
    .where(
      and(
        eq(abAssignments.experimentId, experimentId),
        eq(abAssignments.assignedGroup, group),
      ),
    );

  const assignments = assignedUsers.length;

  // 2. 沒分頁面/key/index → 0
  if (!pageId || !variantKey || variantIndex === null || assignments === 0) {
    return { assignments, likes: 0, dislikes: 0, rate: 0 };
  }

  // 3. 取這些 user 對該變體的反饋
  const userIds = assignedUsers.map((u) => u.userId);
  // 用 IN 子句（Drizzle 的 inArray）
  const { inArray } = await import("drizzle-orm");
  const feedbacks = await db
    .select({
      action: variantFeedback.action,
      cnt: sql<number>`count(*)::int`,
    })
    .from(variantFeedback)
    .where(
      and(
        eq(variantFeedback.pageId, pageId),
        eq(variantFeedback.variantKey, variantKey),
        eq(variantFeedback.variantIndex, variantIndex),
        inArray(variantFeedback.userId, userIds),
      ),
    )
    .groupBy(variantFeedback.action);

  let likes = 0;
  let dislikes = 0;
  for (const r of feedbacks) {
    if (r.action === "like") likes = r.cnt;
    else if (r.action === "dislike") dislikes = r.cnt;
  }

  return {
    assignments,
    likes,
    dislikes,
    rate: likes / Math.max(assignments, 1),
  };
}

/**
 * Two-proportion z-test（雙尾）
 *
 * @returns { zStatistic, pValue }
 */
export function twoProportionZTest(
  successA: number,
  totalA: number,
  successB: number,
  totalB: number,
): { zStatistic: number; pValue: number } {
  if (totalA === 0 || totalB === 0) {
    return { zStatistic: 0, pValue: 1 };
  }

  const pA = successA / totalA;
  const pB = successB / totalB;
  const pPooled = (successA + successB) / (totalA + totalB);

  // 標準誤差
  const se = Math.sqrt(pPooled * (1 - pPooled) * (1 / totalA + 1 / totalB));
  if (se === 0) {
    // 兩組都 0% 或 100%
    return { zStatistic: 0, pValue: 1 };
  }

  const z = (pA - pB) / se;
  const pValue = 2 * (1 - normalCdf(Math.abs(z))); // 雙尾

  return { zStatistic: z, pValue };
}

/**
 * Standard normal CDF（用 Abramowitz & Stegun 近似公式）
 * 精度 < 7.5e-8
 */
function normalCdf(x: number): number {
  // 將 x 轉到正值（CDF(x) = 1 - CDF(-x)，但這裡 x 已經是 |z|）
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014337 * Math.exp(-(x * x) / 2);
  const p =
    d *
    t *
    (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x > 0 ? 1 - p : p;
}
