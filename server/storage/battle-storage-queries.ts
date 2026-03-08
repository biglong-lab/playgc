// 水彈對戰 PK 擂台 — 帶 JOIN 的複合查詢
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  battlePlayerRankings,
  battleRegistrations,
  battleClanMembers,
  battlePlayerResults,
  battleResults,
  battleSlots,
  battleVenues,
} from "@shared/schema";

/** 取得排行榜並 JOIN 玩家名稱 */
export async function getRankingsByFieldWithNames(fieldId: string, limit = 50) {
  return db
    .select({
      ranking: battlePlayerRankings,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(battlePlayerRankings)
    .leftJoin(users, eq(battlePlayerRankings.userId, users.id))
    .where(eq(battlePlayerRankings.fieldId, fieldId))
    .orderBy(desc(battlePlayerRankings.rating))
    .limit(limit);
}

/** 取得時段報名列表並 JOIN 玩家名稱 */
export async function getRegistrationsBySlotWithNames(slotId: string) {
  return db
    .select({
      registration: battleRegistrations,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(battleRegistrations)
    .leftJoin(users, eq(battleRegistrations.userId, users.id))
    .where(eq(battleRegistrations.slotId, slotId))
    .orderBy(battleRegistrations.registeredAt);
}

/** 取得戰隊成員列表並 JOIN 玩家名稱 */
export async function getClanMembersWithNames(clanId: string) {
  return db
    .select({
      member: battleClanMembers,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(battleClanMembers)
    .leftJoin(users, eq(battleClanMembers.userId, users.id))
    .where(and(
      eq(battleClanMembers.clanId, clanId),
      sql`${battleClanMembers.leftAt} IS NULL`,
    ))
    .orderBy(battleClanMembers.joinedAt);
}

/** 取得對戰結果個人戰績並 JOIN 玩家名稱 */
export async function getPlayerResultsByResultWithNames(resultId: string) {
  return db
    .select({
      playerResult: battlePlayerResults,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(battlePlayerResults)
    .leftJoin(users, eq(battlePlayerResults.userId, users.id))
    .where(eq(battlePlayerResults.resultId, resultId));
}

/** 取得對戰歷史並 JOIN 時段 + 場地資訊 */
export async function getPlayerHistoryWithDetails(userId: string, limit = 20) {
  return db
    .select({
      playerResult: battlePlayerResults,
      slotDate: battleSlots.slotDate,
      startTime: battleSlots.startTime,
      venueName: battleVenues.name,
    })
    .from(battlePlayerResults)
    .innerJoin(battleResults, eq(battlePlayerResults.resultId, battleResults.id))
    .innerJoin(battleSlots, eq(battleResults.slotId, battleSlots.id))
    .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
    .where(eq(battlePlayerResults.userId, userId))
    .orderBy(desc(battlePlayerResults.createdAt))
    .limit(limit);
}

/** 取得使用者的即將到來報名 JOIN 時段 + 場地 */
export async function getUpcomingRegistrationsWithDetails(userId: string) {
  return db
    .select({
      registration: battleRegistrations,
      slotDate: battleSlots.slotDate,
      startTime: battleSlots.startTime,
      endTime: battleSlots.endTime,
      slotStatus: battleSlots.status,
      venueName: battleVenues.name,
    })
    .from(battleRegistrations)
    .innerJoin(battleSlots, eq(battleRegistrations.slotId, battleSlots.id))
    .innerJoin(battleVenues, eq(battleSlots.venueId, battleVenues.id))
    .where(and(
      eq(battleRegistrations.userId, userId),
      eq(battleRegistrations.status, "registered"),
    ))
    .orderBy(battleSlots.slotDate, battleSlots.startTime);
}
