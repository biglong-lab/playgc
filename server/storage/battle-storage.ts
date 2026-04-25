// 水彈對戰 PK 擂台 — 資料存取層
import { eq, and, desc, gte, lte, sql } from "drizzle-orm";
import { db, pool } from "../db";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import {
  battleVenues,
  type BattleVenue,
  type InsertBattleVenue,
  battleSlots,
  type BattleSlot,
  type InsertBattleSlot,
  battleRegistrations,
  type BattleRegistration,
  type InsertBattleRegistration,
  battlePremadeGroups,
  type BattlePremadeGroup,
  type InsertBattlePremadeGroup,
  battleResults,
  type BattleResult,
  type InsertBattleResult,
  battlePlayerResults,
  type BattlePlayerResult,
  type InsertBattlePlayerResult,
  battlePlayerRankings,
  type BattlePlayerRanking,
  type InsertBattlePlayerRanking,
  battleClans,
  type BattleClan,
  type InsertBattleClan,
  battleClanMembers,
  type BattleClanMember,
  type InsertBattleClanMember,
  battleNotifications,
  type BattleNotification,
  type InsertBattleNotification,
} from "@shared/schema";

// ============================================================================
// 場地 (Venues)
// ============================================================================

/** 取得場域下所有對戰場地 */
async function getVenuesByField(fieldId: string): Promise<BattleVenue[]> {
  return db
    .select()
    .from(battleVenues)
    .where(and(eq(battleVenues.fieldId, fieldId), eq(battleVenues.isActive, true)))
    .orderBy(desc(battleVenues.createdAt));
}

/** 取得所有活躍對戰場地（不限場域） */
async function getAllActiveVenues(): Promise<BattleVenue[]> {
  return db
    .select()
    .from(battleVenues)
    .where(eq(battleVenues.isActive, true))
    .orderBy(desc(battleVenues.createdAt));
}

/** 依 ID 取得場地 */
async function getVenue(id: string): Promise<BattleVenue | undefined> {
  const [result] = await db
    .select()
    .from(battleVenues)
    .where(eq(battleVenues.id, id));
  return result;
}

/** 建立場地 */
async function createVenue(data: InsertBattleVenue): Promise<BattleVenue> {
  const [result] = await db.insert(battleVenues).values(data).returning();
  return result;
}

/** 更新場地 */
async function updateVenue(id: string, data: Partial<InsertBattleVenue>): Promise<BattleVenue | undefined> {
  const [result] = await db
    .update(battleVenues)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(battleVenues.id, id))
    .returning();
  return result;
}

// ============================================================================
// 時段 (Slots)
// ============================================================================

/** 取得場地的時段列表 */
async function getSlotsByVenue(venueId: string, fromDate?: string): Promise<BattleSlot[]> {
  const conditions = [eq(battleSlots.venueId, venueId)];
  if (fromDate) {
    conditions.push(gte(battleSlots.slotDate, fromDate));
  }
  return db
    .select()
    .from(battleSlots)
    .where(and(...conditions))
    .orderBy(battleSlots.slotDate, battleSlots.startTime);
}

/** 依 ID 取得時段 */
async function getSlot(id: string): Promise<BattleSlot | undefined> {
  const [result] = await db
    .select()
    .from(battleSlots)
    .where(eq(battleSlots.id, id));
  return result;
}

/** 建立時段 */
async function createSlot(data: InsertBattleSlot): Promise<BattleSlot> {
  const [result] = await db.insert(battleSlots).values(data).returning();
  return result;
}

/** 批次建立時段 */
async function createSlotsBatch(dataList: InsertBattleSlot[]): Promise<BattleSlot[]> {
  if (dataList.length === 0) return [];
  return db.insert(battleSlots).values(dataList).returning();
}

/** 更新時段 */
async function updateSlot(id: string, data: Partial<InsertBattleSlot>): Promise<BattleSlot | undefined> {
  const [result] = await db
    .update(battleSlots)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(battleSlots.id, id))
    .returning();
  return result;
}

/** 更新時段人數計數 */
async function updateSlotCount(slotId: string, delta: number): Promise<BattleSlot | undefined> {
  const [result] = await db
    .update(battleSlots)
    .set({
      currentCount: sql`${battleSlots.currentCount} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(battleSlots.id, slotId))
    .returning();
  return result;
}

/** 更新已確認人數 */
async function updateSlotConfirmedCount(slotId: string, delta: number): Promise<BattleSlot | undefined> {
  const [result] = await db
    .update(battleSlots)
    .set({
      confirmedCount: sql`${battleSlots.confirmedCount} + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(battleSlots.id, slotId))
    .returning();
  return result;
}

// ============================================================================
// 報名 (Registrations)
// ============================================================================

/** 取得時段的所有報名 */
async function getRegistrationsBySlot(slotId: string): Promise<BattleRegistration[]> {
  return db
    .select()
    .from(battleRegistrations)
    .where(eq(battleRegistrations.slotId, slotId))
    .orderBy(battleRegistrations.registeredAt);
}

/** 依 ID 取得報名紀錄 */
async function getRegistrationById(id: string): Promise<BattleRegistration | undefined> {
  const [result] = await db
    .select()
    .from(battleRegistrations)
    .where(eq(battleRegistrations.id, id));
  return result;
}

/** 取得使用者在特定時段的報名 */
async function getRegistration(slotId: string, userId: string): Promise<BattleRegistration | undefined> {
  const [result] = await db
    .select()
    .from(battleRegistrations)
    .where(and(
      eq(battleRegistrations.slotId, slotId),
      eq(battleRegistrations.userId, userId),
    ));
  return result;
}

/** 取得使用者的所有即將到來的報名 */
async function getUpcomingRegistrations(userId: string): Promise<BattleRegistration[]> {
  return db
    .select()
    .from(battleRegistrations)
    .where(and(
      eq(battleRegistrations.userId, userId),
      eq(battleRegistrations.status, "registered"),
    ))
    .orderBy(battleRegistrations.registeredAt);
}

/** 建立報名 */
async function createRegistration(data: InsertBattleRegistration): Promise<BattleRegistration> {
  const [result] = await db.insert(battleRegistrations).values(data).returning();
  return result;
}

/** 更新報名狀態 */
async function updateRegistration(
  id: string,
  data: Partial<InsertBattleRegistration>,
): Promise<BattleRegistration | undefined> {
  const [result] = await db
    .update(battleRegistrations)
    .set(data)
    .where(eq(battleRegistrations.id, id))
    .returning();
  return result;
}

/** 取得未取消的有效報名數 */
async function getActiveRegistrationCount(slotId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battleRegistrations)
    .where(and(
      eq(battleRegistrations.slotId, slotId),
      sql`${battleRegistrations.status} != 'cancelled'`,
    ));
  return result[0]?.count ?? 0;
}

// ============================================================================
// 預組小隊 (Premade Groups)
// ============================================================================

/** 依邀請碼查詢預組小隊 */
async function getPremadeGroupByCode(code: string): Promise<BattlePremadeGroup | undefined> {
  const [result] = await db
    .select()
    .from(battlePremadeGroups)
    .where(eq(battlePremadeGroups.accessCode, code.toUpperCase()));
  return result;
}

/** 依 ID 查詢預組小隊 */
async function getPremadeGroup(id: string): Promise<BattlePremadeGroup | undefined> {
  const [result] = await db
    .select()
    .from(battlePremadeGroups)
    .where(eq(battlePremadeGroups.id, id));
  return result;
}

/** 取得時段的所有預組小隊 */
async function getPremadeGroupsBySlot(slotId: string): Promise<BattlePremadeGroup[]> {
  return db
    .select()
    .from(battlePremadeGroups)
    .where(eq(battlePremadeGroups.slotId, slotId));
}

/** 建立預組小隊 */
async function createPremadeGroup(data: InsertBattlePremadeGroup): Promise<BattlePremadeGroup> {
  const [result] = await db.insert(battlePremadeGroups).values(data).returning();
  return result;
}

/** 更新預組小隊成員數 */
async function updatePremadeGroupCount(id: string, delta: number): Promise<BattlePremadeGroup | undefined> {
  const [result] = await db
    .update(battlePremadeGroups)
    .set({
      memberCount: sql`${battlePremadeGroups.memberCount} + ${delta}`,
    })
    .where(eq(battlePremadeGroups.id, id))
    .returning();
  return result;
}

// ============================================================================
// 對戰結果 (Results)
// ============================================================================

/** 取得時段的對戰結果 */
async function getResultBySlot(slotId: string): Promise<BattleResult | undefined> {
  const [result] = await db
    .select()
    .from(battleResults)
    .where(eq(battleResults.slotId, slotId));
  return result;
}

/** 建立對戰結果 */
async function createResult(data: InsertBattleResult): Promise<BattleResult> {
  const [result] = await db.insert(battleResults).values(data).returning();
  return result;
}

/** 取得個人戰績列表 */
async function getPlayerResultsByResult(resultId: string): Promise<BattlePlayerResult[]> {
  return db
    .select()
    .from(battlePlayerResults)
    .where(eq(battlePlayerResults.resultId, resultId));
}

/** 批次建立個人戰績 */
async function createPlayerResults(dataList: InsertBattlePlayerResult[]): Promise<BattlePlayerResult[]> {
  if (dataList.length === 0) return [];
  return db.insert(battlePlayerResults).values(dataList).returning();
}

/** 取得使用者的對戰歷史 */
async function getPlayerHistory(userId: string, limit = 20): Promise<BattlePlayerResult[]> {
  return db
    .select()
    .from(battlePlayerResults)
    .where(eq(battlePlayerResults.userId, userId))
    .orderBy(desc(battlePlayerResults.createdAt))
    .limit(limit);
}

// ============================================================================
// 排名 (Rankings)
// ============================================================================

/** 取得或建立玩家排名 */
async function getOrCreateRanking(userId: string, fieldId: string): Promise<BattlePlayerRanking> {
  const [existing] = await db
    .select()
    .from(battlePlayerRankings)
    .where(and(
      eq(battlePlayerRankings.userId, userId),
      eq(battlePlayerRankings.fieldId, fieldId),
    ));
  if (existing) return existing;

  const [created] = await db
    .insert(battlePlayerRankings)
    .values({ userId, fieldId })
    .returning();
  return created;
}

/** 更新玩家排名 */
async function updateRanking(
  id: string,
  data: Partial<InsertBattlePlayerRanking>,
): Promise<BattlePlayerRanking | undefined> {
  const [result] = await db
    .update(battlePlayerRankings)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(battlePlayerRankings.id, id))
    .returning();
  return result;
}

/** 取得場域排行榜（依 rating 降序） */
async function getRankingsByField(fieldId: string, limit = 50): Promise<BattlePlayerRanking[]> {
  return db
    .select()
    .from(battlePlayerRankings)
    .where(eq(battlePlayerRankings.fieldId, fieldId))
    .orderBy(desc(battlePlayerRankings.rating))
    .limit(limit);
}

/** 取得玩家排名 */
async function getPlayerRanking(userId: string, fieldId: string): Promise<BattlePlayerRanking | undefined> {
  const [result] = await db
    .select()
    .from(battlePlayerRankings)
    .where(and(
      eq(battlePlayerRankings.userId, userId),
      eq(battlePlayerRankings.fieldId, fieldId),
    ));
  return result;
}

// ============================================================================
// 戰隊 (Clans)
// ============================================================================

/** 🆕 Phase 9.8：檢查隊名唯一性（含解散後 180 天鎖名） */
async function isClanNameAvailable(name: string, excludeClanId?: string): Promise<{
  available: boolean;
  reason?: string;
}> {
  // 1. 檢查是否有同名活躍戰隊
  const existing = await db
    .select()
    .from(battleClans)
    .where(eq(battleClans.name, name));

  for (const clan of existing) {
    if (excludeClanId && clan.id === excludeClanId) continue;
    if (clan.isActive) {
      return { available: false, reason: "此隊名已被使用" };
    }
    // 🔒 已解散戰隊：updatedAt 後 180 天內鎖名
    // （用 updatedAt 當解散時間代理 — 等 schema 加 disbandedAt 後可改）
    if (clan.updatedAt) {
      const lockEnd = new Date(clan.updatedAt);
      lockEnd.setDate(lockEnd.getDate() + 180);
      if (new Date() < lockEnd) {
        return {
          available: false,
          reason: `此隊名於 ${lockEnd.toLocaleDateString("zh-TW")} 後解鎖`,
        };
      }
    }
  }

  return { available: true };
}

/** 建立戰隊（加唯一性檢查） */
async function createClan(data: InsertBattleClan): Promise<BattleClan> {
  // 🚫 Phase 9.8 唯一性檢查
  const check = await isClanNameAvailable(data.name);
  if (!check.available) {
    throw new Error(check.reason ?? "隊名不可用");
  }
  const [result] = await db.insert(battleClans).values(data).returning();
  return result;
}

/** 建立戰隊 + 自動加入隊長（事務） */
async function createClanWithLeader(data: InsertBattleClan): Promise<BattleClan> {
  // 🚫 Phase 9.8 唯一性檢查（在 transaction 外先擋）
  const check = await isClanNameAvailable(data.name);
  if (!check.available) {
    throw new Error(check.reason ?? "隊名不可用");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txDb = drizzle(client, { schema });

    // 建立戰隊
    const [clan] = await txDb.insert(battleClans).values(data).returning();

    // 加入隊長為成員
    await txDb.insert(battleClanMembers).values({
      clanId: clan.id,
      userId: data.leaderId,
      role: "leader",
    });

    // 更新成員數
    await txDb.update(battleClans).set({
      memberCount: sql`${battleClans.memberCount} + 1`,
      updatedAt: new Date(),
    }).where(eq(battleClans.id, clan.id));

    await client.query("COMMIT");
    return clan;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** 依 ID 取得戰隊 */
async function getClan(id: string): Promise<BattleClan | undefined> {
  const [result] = await db
    .select()
    .from(battleClans)
    .where(eq(battleClans.id, id));
  return result;
}

/** 取得場域下所有戰隊 */
async function getClansByField(fieldId: string, limit = 50): Promise<BattleClan[]> {
  return db
    .select()
    .from(battleClans)
    .where(and(eq(battleClans.fieldId, fieldId), eq(battleClans.isActive, true)))
    .orderBy(desc(battleClans.clanRating))
    .limit(limit);
}

/** 更新戰隊 */
async function updateClan(id: string, data: Partial<InsertBattleClan>): Promise<BattleClan | undefined> {
  const [result] = await db
    .update(battleClans)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(battleClans.id, id))
    .returning();
  return result;
}

/** 取得戰隊成員列表 */
async function getClanMembers(clanId: string): Promise<BattleClanMember[]> {
  return db
    .select()
    .from(battleClanMembers)
    .where(and(
      eq(battleClanMembers.clanId, clanId),
      sql`${battleClanMembers.leftAt} IS NULL`,
    ))
    .orderBy(battleClanMembers.joinedAt);
}

/** 新增戰隊成員 */
async function addClanMember(data: InsertBattleClanMember): Promise<BattleClanMember> {
  const [result] = await db.insert(battleClanMembers).values(data).returning();
  // 更新戰隊成員數
  await db
    .update(battleClans)
    .set({
      memberCount: sql`${battleClans.memberCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(battleClans.id, data.clanId));
  return result;
}

/** 成員離開戰隊 */
async function removeClanMember(clanId: string, userId: string): Promise<void> {
  await db
    .update(battleClanMembers)
    .set({ leftAt: new Date() })
    .where(and(
      eq(battleClanMembers.clanId, clanId),
      eq(battleClanMembers.userId, userId),
      sql`${battleClanMembers.leftAt} IS NULL`,
    ));
  await db
    .update(battleClans)
    .set({
      memberCount: sql`GREATEST(${battleClans.memberCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(battleClans.id, clanId));
}

/** 查詢使用者所屬戰隊（未離開的） */
async function getUserClan(userId: string, fieldId: string): Promise<{ clan: BattleClan; membership: BattleClanMember } | undefined> {
  const memberships = await db
    .select()
    .from(battleClanMembers)
    .innerJoin(battleClans, eq(battleClanMembers.clanId, battleClans.id))
    .where(and(
      eq(battleClanMembers.userId, userId),
      eq(battleClans.fieldId, fieldId),
      sql`${battleClanMembers.leftAt} IS NULL`,
    ))
    .limit(1);
  if (memberships.length === 0) return undefined;
  return {
    clan: memberships[0].battle_clans,
    membership: memberships[0].battle_clan_members,
  };
}

/** 更新成員角色 */
async function updateClanMemberRole(clanId: string, userId: string, role: string): Promise<BattleClanMember | undefined> {
  const [result] = await db
    .update(battleClanMembers)
    .set({ role })
    .where(and(
      eq(battleClanMembers.clanId, clanId),
      eq(battleClanMembers.userId, userId),
      sql`${battleClanMembers.leftAt} IS NULL`,
    ))
    .returning();
  return result;
}

/** 更新戰隊戰績 */
async function updateClanStats(
  clanId: string,
  result: "win" | "loss" | "draw",
): Promise<void> {
  const field = result === "win" ? battleClans.totalWins
    : result === "loss" ? battleClans.totalLosses
    : battleClans.totalDraws;
  await db
    .update(battleClans)
    .set({
      [result === "win" ? "totalWins" : result === "loss" ? "totalLosses" : "totalDraws"]:
        sql`${field} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(battleClans.id, clanId));
}

// ============================================================================
// 通知 (Notifications)
// ============================================================================

/** 建立通知 */
async function createNotification(data: InsertBattleNotification): Promise<BattleNotification> {
  const [result] = await db.insert(battleNotifications).values(data).returning();
  return result;
}

/** 批次建立通知 */
async function createNotificationsBatch(dataList: InsertBattleNotification[]): Promise<BattleNotification[]> {
  if (dataList.length === 0) return [];
  return db.insert(battleNotifications).values(dataList).returning();
}

/** 取得使用者的通知列表 */
async function getNotificationsByUser(userId: string, limit = 30): Promise<BattleNotification[]> {
  return db
    .select()
    .from(battleNotifications)
    .where(eq(battleNotifications.userId, userId))
    .orderBy(desc(battleNotifications.createdAt))
    .limit(limit);
}

/** 取得使用者未讀數量 */
async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(battleNotifications)
    .where(and(
      eq(battleNotifications.userId, userId),
      eq(battleNotifications.isRead, false),
    ));
  return result[0]?.count ?? 0;
}

/** 標記單則通知為已讀 */
async function markNotificationAsRead(id: string, userId: string): Promise<void> {
  await db
    .update(battleNotifications)
    .set({ isRead: true, status: "read" })
    .where(and(
      eq(battleNotifications.id, id),
      eq(battleNotifications.userId, userId),
    ));
}

/** 標記所有通知為已讀 */
async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await db
    .update(battleNotifications)
    .set({ isRead: true, status: "read" })
    .where(and(
      eq(battleNotifications.userId, userId),
      eq(battleNotifications.isRead, false),
    ));
}

/** 取得待發送的排程通知（scheduledAt <= now 且 status = pending） */
async function getPendingScheduledNotifications(now: Date): Promise<BattleNotification[]> {
  return db
    .select()
    .from(battleNotifications)
    .where(and(
      eq(battleNotifications.status, "pending"),
      lte(battleNotifications.scheduledAt, now),
    ))
    .orderBy(battleNotifications.scheduledAt)
    .limit(100);
}

/** 更新通知狀態 */
async function updateNotificationStatus(
  id: string,
  status: string,
  sentAt?: Date,
): Promise<void> {
  await db
    .update(battleNotifications)
    .set({ status, sentAt: sentAt ?? new Date() })
    .where(eq(battleNotifications.id, id));
}

// ============================================================================
// 匯出
// ============================================================================
export const battleStorageMethods = {
  // 場地
  getVenuesByField,
  getAllActiveVenues,
  getVenue,
  createVenue,
  updateVenue,
  // 時段
  getSlotsByVenue,
  getSlot,
  createSlot,
  createSlotsBatch,
  updateSlot,
  updateSlotCount,
  updateSlotConfirmedCount,
  // 報名
  getRegistrationsBySlot,
  getRegistrationById,
  getRegistration,
  getUpcomingRegistrations,
  createRegistration,
  updateRegistration,
  getActiveRegistrationCount,
  // 預組小隊
  getPremadeGroupByCode,
  getPremadeGroup,
  getPremadeGroupsBySlot,
  createPremadeGroup,
  updatePremadeGroupCount,
  // 對戰結果
  getResultBySlot,
  createResult,
  getPlayerResultsByResult,
  createPlayerResults,
  getPlayerHistory,
  // 排名
  getOrCreateRanking,
  updateRanking,
  getRankingsByField,
  getPlayerRanking,
  // 戰隊
  createClan,
  createClanWithLeader,
  isClanNameAvailable,
  getClan,
  getClansByField,
  updateClan,
  getClanMembers,
  addClanMember,
  removeClanMember,
  getUserClan,
  updateClanMemberRole,
  updateClanStats,
  // 通知
  createNotification,
  createNotificationsBatch,
  getNotificationsByUser,
  getUnreadCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getPendingScheduledNotifications,
  updateNotificationStatus,
};

// Re-export 子模組
export * from "./battle-storage-queries";
export * from "./battle-storage-seasons";
export * from "./battle-storage-achievements";
