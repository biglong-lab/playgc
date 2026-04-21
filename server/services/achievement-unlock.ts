// 🏆 遊戲成就自動解鎖服務
//
// 支援的 condition 格式（新舊相容）：
//   新 schema:
//     { type: "visit_location", locationId: "xxx" }
//     { type: "collect_items", itemIds: ["a","b"] }
//     { type: "score_threshold", score: 100 }
//     { type: "complete_game" }
//     { type: "chapter_complete", chapterId: "xxx" }
//   舊 schema（自動推斷 type）：
//     { location_id: N }  → 視為 visit_location
//     { item_id: "x" }    → 視為 collect_item
//     { score: N }        → 視為 score_threshold
//
// 觸發時機（由 caller 呼叫）：
//   - session 完成時（check 所有條件）
//   - page 完成獲得 item / 訪問 location 時（增量 check）

import { db } from "../db";
import {
  achievements,
  playerAchievements,
  locationVisits,
  type Achievement,
  type InsertPlayerAchievement,
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";

export interface AchievementCheckContext {
  userId: string;
  gameId: string;
  sessionId?: string;
  /** 當前 session 分數 */
  score?: number;
  /** 當前 inventory */
  inventory?: string[];
  /** 當前已造訪的 location_id 清單 */
  visitedLocationIds?: string[];
  /** 是否完成遊戲 */
  gameCompleted?: boolean;
  /** 完成的章節 ID（如有）*/
  completedChapterId?: string;
}

/**
 * 判斷單一成就 condition 是否符合 context
 * 向下相容舊 schema（無 type 時從欄位推斷）
 */
function matchesCondition(
  achievement: Achievement,
  ctx: AchievementCheckContext,
): boolean {
  const cond = (achievement.condition as Record<string, unknown>) || {};
  let type = (cond.type as string) || "";

  // 舊 schema 推斷
  if (!type) {
    if (cond.location_id != null || cond.locationId != null) type = "visit_location";
    else if (cond.item_id != null || cond.itemId != null) type = "collect_item";
    else if (cond.score != null) type = "score_threshold";
    else if (cond.chapter_id != null) type = "chapter_complete";
    else return false; // 無可識別條件
  }

  switch (type) {
    case "visit_location": {
      const targetLocId = String(cond.locationId ?? cond.location_id ?? "");
      if (!targetLocId) return false;
      return !!ctx.visitedLocationIds?.map(String).includes(targetLocId);
    }
    case "collect_item":
    case "has_item": {
      const targetItemId = String(cond.itemId ?? cond.item_id ?? "");
      if (!targetItemId) return false;
      return !!ctx.inventory?.map(String).includes(targetItemId);
    }
    case "collect_items": {
      const required = (cond.itemIds as string[]) || [];
      if (required.length === 0) return false;
      return required.every((id) => ctx.inventory?.map(String).includes(String(id)));
    }
    case "score_threshold": {
      const threshold = Number(cond.score ?? cond.threshold ?? 0);
      return (ctx.score ?? 0) >= threshold;
    }
    case "complete_game": {
      return !!ctx.gameCompleted;
    }
    case "chapter_complete": {
      const targetChapterId = String(cond.chapterId ?? cond.chapter_id ?? "");
      if (!targetChapterId) return false;
      return ctx.completedChapterId === targetChapterId;
    }
    default:
      return false;
  }
}

/**
 * 檢查該 context 能解鎖哪些 achievement，並批次 INSERT player_achievements
 * 冪等：已解鎖的不會重複插入（依 unique constraint）
 * @returns 本次新解鎖的 achievement 列表
 */
export async function checkAndUnlockAchievements(
  ctx: AchievementCheckContext,
): Promise<Achievement[]> {
  // 若 caller 沒提供 visitedLocationIds，從 location_visits 表查
  if (!ctx.visitedLocationIds && ctx.sessionId) {
    try {
      const visitRows = await db
        .select({ locationId: locationVisits.locationId })
        .from(locationVisits)
        .where(eq(locationVisits.gameSessionId, ctx.sessionId));
      ctx.visitedLocationIds = visitRows
        .map((v) => String(v.locationId))
        .filter(Boolean);
    } catch {
      ctx.visitedLocationIds = [];
    }
  }

  // 1. 抓該遊戲所有 achievements
  const allAchievements = await db
    .select()
    .from(achievements)
    .where(eq(achievements.gameId, ctx.gameId));

  if (allAchievements.length === 0) return [];

  // 2. 排除該使用者已經解鎖的
  const alreadyUnlocked = await db
    .select({ achievementId: playerAchievements.achievementId })
    .from(playerAchievements)
    .where(
      and(
        eq(playerAchievements.userId, ctx.userId),
        inArray(
          playerAchievements.achievementId,
          allAchievements.map((a) => a.id),
        ),
      ),
    );
  const unlockedSet = new Set(alreadyUnlocked.map((u) => u.achievementId));

  // 3. 檢查每個未解鎖的 achievement 是否符合條件
  const toUnlock: Achievement[] = [];
  for (const ach of allAchievements) {
    if (unlockedSet.has(ach.id)) continue;
    if (matchesCondition(ach, ctx)) toUnlock.push(ach);
  }

  if (toUnlock.length === 0) return [];

  // 4. 批次 insert
  try {
    const inserts: InsertPlayerAchievement[] = toUnlock.map((ach) => ({
      userId: ctx.userId,
      achievementId: ach.id,
      gameSessionId: ctx.sessionId ?? null,
    }));
    await db.insert(playerAchievements).values(inserts);
  } catch (err) {
    console.error("[achievement-unlock] insert 失敗（可能 race condition）:", err);
  }

  return toUnlock;
}
