// 水彈對戰 PK 擂台 — 成就 Storage
import { db } from "../db";
import {
  battleAchievementDefs,
  battlePlayerAchievements,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { DEFAULT_ACHIEVEMENTS } from "../seed/battle-achievements-seed";

/** 取得所有成就定義 */
export async function getAllAchievementDefs() {
  return db.select().from(battleAchievementDefs);
}

/** 取得玩家的已解鎖成就 */
export async function getPlayerAchievements(userId: string) {
  return db
    .select({
      id: battlePlayerAchievements.id,
      achievementId: battlePlayerAchievements.achievementId,
      userId: battlePlayerAchievements.userId,
      unlockedAt: battlePlayerAchievements.unlockedAt,
      resultId: battlePlayerAchievements.resultId,
      key: battleAchievementDefs.key,
      name: battleAchievementDefs.name,
      description: battleAchievementDefs.description,
      iconUrl: battleAchievementDefs.iconUrl,
      category: battleAchievementDefs.category,
      rarity: battleAchievementDefs.rarity,
      points: battleAchievementDefs.points,
    })
    .from(battlePlayerAchievements)
    .innerJoin(
      battleAchievementDefs,
      eq(battlePlayerAchievements.achievementId, battleAchievementDefs.id),
    )
    .where(eq(battlePlayerAchievements.userId, userId));
}

/** 檢查玩家是否已有特定成就 */
export async function hasAchievement(userId: string, achievementId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: battlePlayerAchievements.id })
    .from(battlePlayerAchievements)
    .where(
      and(
        eq(battlePlayerAchievements.userId, userId),
        eq(battlePlayerAchievements.achievementId, achievementId),
      ),
    )
    .limit(1);
  return !!existing;
}

/** 解鎖成就 */
export async function unlockAchievement(
  userId: string,
  achievementId: string,
  resultId?: string,
) {
  const [achievement] = await db
    .insert(battlePlayerAchievements)
    .values({
      achievementId,
      userId,
      resultId: resultId ?? null,
    })
    .onConflictDoNothing()
    .returning();
  return achievement ?? null;
}

/** 種子成就資料 — 若無資料則插入預設成就 */
export async function seedAchievements() {
  const existing = await db.select({ key: battleAchievementDefs.key }).from(battleAchievementDefs);
  const existingKeys = new Set(existing.map((e) => e.key));

  const toInsert = DEFAULT_ACHIEVEMENTS.filter((a) => !existingKeys.has(a.key));
  if (toInsert.length === 0) return 0;

  await db.insert(battleAchievementDefs).values(
    toInsert.map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      category: a.category,
      rarity: a.rarity,
      condition: a.condition,
      points: a.points,
      isHidden: a.isHidden,
    })),
  );

  return toInsert.length;
}
