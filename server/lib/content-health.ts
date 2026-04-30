// 🏥 內容健康度監控（Phase 15）
//
// 目的：自動偵測平台上「不健康」的內容
//   - 殭屍變體（從沒被選中過）：占用 pool 配額但對玩家無價值
//   - 孤兒任務（沒玩家完成過）：可能太難 / 描述不清 / 入口缺失
//   - 死路 page（玩家進去就退出）：UI/銜接 / 設計問題
//
// 用途：
//   - cron 每天統計（admin 後台儀表板顯示）
//   - admin 主動點「健康檢查」立即查
//
// 範圍限制（不擴散）：
//   - 只回傳偵測結果，不做自動清理（讓 admin 決定）
//   - 不改 pool / 不改 page（純讀取分析）
//   - 不寫 metrics 表（統計結果 in-memory，由 caller 處理是否快取）

import { sql, and, eq, gt, gte, isNotNull } from "drizzle-orm";
import { db } from "../db";
import {
  pages,
  variantFeedback,
  type VariantPool,
} from "@shared/schema";

// ============================================================================
// 殭屍變體偵測（P15-1）
// ============================================================================

/**
 * 殭屍變體：在 variantPool 內存在，但從沒被任何玩家「看到」過（沒任何 feedback 紀錄）
 *
 * 判定：
 *   1. 從 pages.variantPool 取所有 (pageId, variantKey, variantIndex)
 *   2. 從 variant_feedback 找有事件的 (pageId, variantKey, variantIndex) 集合
 *   3. 不在集合中的變體 → 候選殭屍
 *   4. 候選變體的 generatedAt 距今 ≥ minDays → 確定殭屍（避免剛生成的誤判）
 */
export interface ZombieVariant {
  pageId: string;
  gameId: string | null;
  fieldId: string | null;
  variantKey: "success" | "fail" | "nearMiss" | "hint";
  variantIndex: number;
  variantText: string;
  daysOld: number; // pool generatedAt 距今天數（無 generatedAt 用 createdAt）
}

export interface DetectZombieOptions {
  /** 場域 ID 過濾 */
  fieldId?: string;
  /** 遊戲 ID 過濾 */
  gameId?: string;
  /** 變體存在多少天未被觸發才算殭屍（預設 14 天，避免剛生成的誤判） */
  minDays?: number;
  /** 上限（避免回傳太多） */
  limit?: number;
}

export async function detectZombieVariants(
  options: DetectZombieOptions = {},
): Promise<ZombieVariant[]> {
  const minDays = options.minDays ?? 14;
  const limit = options.limit ?? 500;
  const now = Date.now();
  const minMs = minDays * 24 * 60 * 60 * 1000;

  // 1. 取所有有 variantPool 的 pages
  const filters = [isNotNull(pages.variantPool)];
  if (options.fieldId) {
    // pages 沒直接 fieldId，要透過 games join；但為簡化本次先不 join
    // P15-1 只做核心邏輯，fieldId 過濾留給 caller post-filter
  }
  if (options.gameId) {
    filters.push(eq(pages.gameId, options.gameId));
  }

  const allPages = await db
    .select({
      id: pages.id,
      gameId: pages.gameId,
      variantPool: pages.variantPool,
      createdAt: pages.createdAt,
    })
    .from(pages)
    .where(and(...filters));

  if (allPages.length === 0) {
    return [];
  }

  // 2. 一次性取所有 variantFeedback 的 (pageId, variantKey, variantIndex)
  //    用 SELECT DISTINCT 避免重複
  const pageIds = allPages.map((p) => p.id);
  const feedbackRows = await db
    .selectDistinct({
      pageId: variantFeedback.pageId,
      variantKey: variantFeedback.variantKey,
      variantIndex: variantFeedback.variantIndex,
    })
    .from(variantFeedback)
    .where(sql`${variantFeedback.pageId} = ANY(${pageIds})`);

  // 3. 建立「有 feedback」的 Set 快查
  const seenSet = new Set<string>();
  for (const r of feedbackRows) {
    seenSet.add(`${r.pageId}|${r.variantKey}|${r.variantIndex}`);
  }

  // 4. 遍歷每個 page 的 pool，找出不在 set 裡的
  const zombies: ZombieVariant[] = [];
  for (const page of allPages) {
    const pool = page.variantPool as VariantPool | null;
    if (!pool) continue;

    // 計算 daysOld
    const generatedTs = pool.generatedAt
      ? new Date(pool.generatedAt).getTime()
      : page.createdAt
        ? new Date(page.createdAt).getTime()
        : null;
    if (!generatedTs) continue;
    const ageMs = now - generatedTs;
    if (ageMs < minMs) continue; // 太新，不算殭屍

    const daysOld = Math.floor(ageMs / (24 * 60 * 60 * 1000));

    // 遍歷 4 種 variantKey
    const keys: Array<"success" | "fail" | "nearMiss" | "hint"> = [
      "success",
      "fail",
      "nearMiss",
      "hint",
    ];
    for (const key of keys) {
      const variants = pool[key];
      if (!variants || !Array.isArray(variants)) continue;

      for (let i = 0; i < variants.length; i++) {
        const seenKey = `${page.id}|${key}|${i}`;
        if (seenSet.has(seenKey)) continue;

        zombies.push({
          pageId: page.id,
          gameId: page.gameId,
          fieldId: null, // 留 caller 補（避免本層 join 增加負載）
          variantKey: key,
          variantIndex: i,
          variantText: variants[i],
          daysOld,
        });

        if (zombies.length >= limit) {
          return zombies;
        }
      }
    }
  }

  return zombies;
}
