// 水彈對戰 PK 擂台 — 賽季 Storage
import { db } from "../db";
import {
  battleSeasons,
  battleSeasonRankings,
  battlePlayerRankings,
  getTierFromRating,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";

/** 建立新賽季 */
export async function createSeason(data: {
  fieldId: string;
  seasonNumber: number;
  name: string;
  startDate: Date;
  resetRatingTo?: number;
  rewards?: unknown[];
}) {
  const [season] = await db
    .insert(battleSeasons)
    .values({
      fieldId: data.fieldId,
      seasonNumber: data.seasonNumber,
      name: data.name,
      startDate: data.startDate,
      resetRatingTo: data.resetRatingTo ?? 1000,
      rewards: (data.rewards ?? []) as typeof battleSeasons.$inferInsert["rewards"],
      status: "active",
    })
    .returning();
  return season;
}

/** 取得場域的活躍賽季 */
export async function getActiveSeason(fieldId: string) {
  const [season] = await db
    .select()
    .from(battleSeasons)
    .where(and(eq(battleSeasons.fieldId, fieldId), eq(battleSeasons.status, "active")))
    .limit(1);
  return season ?? null;
}

/** 取得場域的所有賽季（由新到舊） */
export async function getSeasonsByField(fieldId: string) {
  return db
    .select()
    .from(battleSeasons)
    .where(eq(battleSeasons.fieldId, fieldId))
    .orderBy(desc(battleSeasons.seasonNumber));
}

/** 結束賽季 */
export async function endSeason(seasonId: string) {
  const [updated] = await db
    .update(battleSeasons)
    .set({ status: "ended", endDate: new Date() })
    .where(eq(battleSeasons.id, seasonId))
    .returning();
  return updated;
}

/** 快照賽季排名 — 將當前排名寫入 battleSeasonRankings */
export async function snapshotSeasonRankings(seasonId: string, fieldId: string) {
  // 取得該場域所有排名
  const rankings = await db
    .select()
    .from(battlePlayerRankings)
    .where(eq(battlePlayerRankings.fieldId, fieldId))
    .orderBy(desc(battlePlayerRankings.rating));

  if (rankings.length === 0) return [];

  const inserts = rankings.map((r, idx) => ({
    seasonId,
    userId: r.userId,
    fieldId,
    finalRating: r.rating,
    finalTier: r.tier,
    totalBattles: r.totalBattles,
    wins: r.wins,
    losses: r.losses,
    draws: r.draws,
    rank: idx + 1,
  }));

  return db.insert(battleSeasonRankings).values(inserts).returning();
}

/** 重置場域排名 */
export async function resetFieldRankings(fieldId: string, resetTo: number) {
  const tier = getTierFromRating(resetTo);
  await db
    .update(battlePlayerRankings)
    .set({
      rating: resetTo,
      tier,
      totalBattles: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winStreak: 0,
      bestStreak: 0,
      mvpCount: 0,
      season: db.$count(
        battleSeasons,
        eq(battleSeasons.fieldId, fieldId),
      ),
      seasonRating: resetTo,
      updatedAt: new Date(),
    })
    .where(eq(battlePlayerRankings.fieldId, fieldId));
}

/** 取得賽季排名 */
export async function getSeasonRankings(seasonId: string, limit = 50) {
  return db
    .select()
    .from(battleSeasonRankings)
    .where(eq(battleSeasonRankings.seasonId, seasonId))
    .orderBy(battleSeasonRankings.rank)
    .limit(limit);
}

/** 取得玩家的賽季歷史 */
export async function getPlayerSeasonHistory(userId: string, fieldId: string) {
  return db
    .select({
      id: battleSeasonRankings.id,
      seasonId: battleSeasonRankings.seasonId,
      finalRating: battleSeasonRankings.finalRating,
      finalTier: battleSeasonRankings.finalTier,
      totalBattles: battleSeasonRankings.totalBattles,
      wins: battleSeasonRankings.wins,
      losses: battleSeasonRankings.losses,
      draws: battleSeasonRankings.draws,
      rank: battleSeasonRankings.rank,
      seasonName: battleSeasons.name,
      seasonNumber: battleSeasons.seasonNumber,
      startDate: battleSeasons.startDate,
      endDate: battleSeasons.endDate,
    })
    .from(battleSeasonRankings)
    .innerJoin(battleSeasons, eq(battleSeasonRankings.seasonId, battleSeasons.id))
    .where(
      and(
        eq(battleSeasonRankings.userId, userId),
        eq(battleSeasonRankings.fieldId, fieldId),
      ),
    )
    .orderBy(desc(battleSeasons.seasonNumber));
}

/** 取得賽季資訊 */
export async function getSeason(seasonId: string) {
  const [season] = await db
    .select()
    .from(battleSeasons)
    .where(eq(battleSeasons.id, seasonId))
    .limit(1);
  return season ?? null;
}
