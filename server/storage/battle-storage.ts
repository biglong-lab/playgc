// 水彈對戰 PK 擂台 — 資料存取層
import { eq, and, desc, gte, sql } from "drizzle-orm";
import { db } from "../db";
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
// 匯出
// ============================================================================
export const battleStorageMethods = {
  // 場地
  getVenuesByField,
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
};
