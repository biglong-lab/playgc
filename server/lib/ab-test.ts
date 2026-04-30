// 🔬 A/B 測試分組演算法
//
// 用途：給定 (userId, experimentId)，確定性分配到 A 或 B 組
//
// 核心：
//   - 同玩家同實驗永遠同組（保證實驗一致性）
//   - 50/50 分佈（用 hash 取模）
//   - 持久化到 ab_assignments 表
//
// 為什麼用 hash 而不是 random：
//   - 確定性：同 userId 重複請求會回同組
//   - 防偷看：玩家不能透過 reload 重新分組

import crypto from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  abExperiments,
  abAssignments,
  type AbGroup,
} from "@shared/schema";

/**
 * 取得玩家在某實驗的分組（持久化）
 *
 * 流程：
 *   1. 查 ab_assignments 看是否已分組
 *   2. 已分組 → 直接回
 *   3. 沒分組 → 用 hash 確定性分組 → INSERT
 *
 * @param experimentId 實驗 ID
 * @param userId 玩家 ID（匿名玩家可傳 sessionId 當 userId）
 * @returns 'a' / 'b'
 */
export async function assignVariant(
  experimentId: string,
  userId: string,
): Promise<AbGroup> {
  // 已分組？
  const [existing] = await db
    .select()
    .from(abAssignments)
    .where(
      and(
        eq(abAssignments.experimentId, experimentId),
        eq(abAssignments.userId, userId),
      ),
    )
    .limit(1);

  if (existing) {
    return existing.assignedGroup as AbGroup;
  }

  // 沒分組：用 hash 確定性分配
  const group = hashAssign(experimentId, userId);

  // INSERT（onConflictDoNothing 防 race condition）
  await db
    .insert(abAssignments)
    .values({
      experimentId,
      userId,
      assignedGroup: group,
    })
    .onConflictDoNothing();

  return group;
}

/**
 * 確定性 hash 分組（不持久化，內部用）
 * SHA256(experimentId + userId) → 取 hex 第一字 → 0-7=a, 8-f=b
 */
export function hashAssign(experimentId: string, userId: string): AbGroup {
  const h = crypto
    .createHash("sha256")
    .update(`${experimentId}|${userId}`)
    .digest("hex");
  const firstByte = parseInt(h[0], 16);
  return firstByte < 8 ? "a" : "b";
}

/**
 * 找適用於某 page+variantKey 的 active 實驗（玩家請求時用）
 *
 * @returns active 實驗（最多 1 個；同 page+key 應只有 1 個 running 實驗）
 */
export async function findActiveExperiment(
  pageId: string,
  variantKey: string,
): Promise<{
  experimentId: string;
  variantAIndex: number;
  variantBIndex: number;
} | null> {
  const [exp] = await db
    .select({
      id: abExperiments.id,
      variantAIndex: abExperiments.variantAIndex,
      variantBIndex: abExperiments.variantBIndex,
    })
    .from(abExperiments)
    .where(
      and(
        eq(abExperiments.status, "running"),
        eq(abExperiments.targetPageId, pageId),
        eq(abExperiments.targetVariantKey, variantKey),
      ),
    )
    .limit(1);

  if (!exp || exp.variantAIndex === null || exp.variantBIndex === null) {
    return null;
  }

  return {
    experimentId: exp.id,
    variantAIndex: exp.variantAIndex,
    variantBIndex: exp.variantBIndex,
  };
}

/**
 * 取實驗某組的曝光統計（給 ab-stats.ts 用）
 */
export async function getGroupAssignmentCount(
  experimentId: string,
): Promise<{ a: number; b: number }> {
  const rows = await db
    .select({
      group: abAssignments.assignedGroup,
      cnt: sql<number>`count(*)::int`,
    })
    .from(abAssignments)
    .where(eq(abAssignments.experimentId, experimentId))
    .groupBy(abAssignments.assignedGroup);

  let a = 0;
  let b = 0;
  for (const r of rows) {
    if (r.group === "a") a = r.cnt;
    else if (r.group === "b") b = r.cnt;
  }
  return { a, b };
}
