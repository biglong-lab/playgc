// GPS 地點、玩家位置追蹤、地點造訪、導航路徑、成就相關的資料庫儲存方法
import { eq, desc, and, asc, gte, lte } from "drizzle-orm";
import { db } from "../db";
import {
  locations,
  playerLocations,
  locationVisits,
  navigationPaths,
  achievements,
  playerAchievements,
  type Location,
  type InsertLocation,
  type PlayerLocation,
  type InsertPlayerLocation,
  type LocationVisit,
  type InsertLocationVisit,
  type NavigationPath,
  type InsertNavigationPath,
  type Achievement,
  type InsertAchievement,
  type PlayerAchievement,
  type InsertPlayerAchievement,
} from "@shared/schema";

/** 地點儲存方法集合 */
export const locationStorageMethods = {
  // ===== GPS 地點 =====

  /** 取得遊戲的地點（可依類型和狀態篩選） */
  async getLocations(gameId: string, filters?: { type?: string; status?: string }): Promise<Location[]> {
    const conditions = [eq(locations.gameId, gameId)];

    if (filters?.type) {
      conditions.push(eq(locations.locationType, filters.type));
    }
    if (filters?.status) {
      conditions.push(eq(locations.status, filters.status));
    }

    return db
      .select()
      .from(locations)
      .where(and(...conditions))
      .orderBy(asc(locations.orderIndex));
  },

  /** 根據 ID 取得地點 */
  async getLocation(id: number): Promise<Location | undefined> {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  },

  /** 建立新地點 */
  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  },

  /** 更新地點 */
  async updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updated] = await db
      .update(locations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return updated;
  },

  /** 刪除地點 */
  async deleteLocation(id: number): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  },

  // ===== 玩家位置追蹤 =====

  /** 建立玩家位置記錄 */
  async createPlayerLocation(location: InsertPlayerLocation): Promise<PlayerLocation> {
    const [newLocation] = await db.insert(playerLocations).values(location).returning();
    return newLocation;
  },

  /** 取得玩家目前位置（最近一筆） */
  async getPlayerCurrentLocation(sessionId: string, playerId: string): Promise<PlayerLocation | undefined> {
    const result = await db
      .select()
      .from(playerLocations)
      .where(
        and(
          eq(playerLocations.gameSessionId, sessionId),
          eq(playerLocations.playerId, playerId)
        )
      )
      .orderBy(desc(playerLocations.timestamp))
      .limit(1);
    return result[0];
  },

  /** 取得玩家位置歷史記錄（支援時間範圍和筆數限制） */
  async getPlayerLocationHistory(
    sessionId: string,
    playerId: string,
    options?: { startTime?: Date; endTime?: Date; limit?: number }
  ): Promise<PlayerLocation[]> {
    const conditions = [
      eq(playerLocations.gameSessionId, sessionId),
      eq(playerLocations.playerId, playerId),
    ];

    if (options?.startTime) {
      conditions.push(gte(playerLocations.timestamp, options.startTime));
    }
    if (options?.endTime) {
      conditions.push(lte(playerLocations.timestamp, options.endTime));
    }

    let query = db
      .select()
      .from(playerLocations)
      .where(and(...conditions))
      .orderBy(desc(playerLocations.timestamp));

    if (options?.limit) {
      query = query.limit(options.limit) as any;
    }

    return query;
  },

  /** 取得工作階段中所有隊員的最近位置（60 秒內） */
  async getTeamLocations(sessionId: string): Promise<PlayerLocation[]> {
    const oneMinuteAgo = new Date(Date.now() - 60000);
    return db
      .select()
      .from(playerLocations)
      .where(
        and(
          eq(playerLocations.gameSessionId, sessionId),
          gte(playerLocations.timestamp, oneMinuteAgo)
        )
      )
      .orderBy(desc(playerLocations.timestamp));
  },

  // ===== 地點造訪記錄 =====

  /** 建立地點造訪記錄 */
  async createLocationVisit(visit: InsertLocationVisit): Promise<LocationVisit> {
    const [newVisit] = await db.insert(locationVisits).values(visit).returning();
    return newVisit;
  },

  /** 取得玩家在工作階段中的所有造訪記錄 */
  async getLocationVisits(sessionId: string, playerId: string): Promise<LocationVisit[]> {
    return db
      .select()
      .from(locationVisits)
      .where(
        and(
          eq(locationVisits.gameSessionId, sessionId),
          eq(locationVisits.playerId, playerId)
        )
      )
      .orderBy(desc(locationVisits.visitedAt));
  },

  /** 檢查玩家是否已造訪過指定地點 */
  async hasVisitedLocation(locationId: number, sessionId: string, playerId: string): Promise<boolean> {
    const result = await db
      .select()
      .from(locationVisits)
      .where(
        and(
          eq(locationVisits.locationId, locationId),
          eq(locationVisits.gameSessionId, sessionId),
          eq(locationVisits.playerId, playerId),
          eq(locationVisits.completed, true)
        )
      )
      .limit(1);
    return result.length > 0;
  },

  // ===== 導航路徑 =====

  /** 取得遊戲的導航路徑 */
  async getNavigationPaths(gameId: string): Promise<NavigationPath[]> {
    return db.select().from(navigationPaths).where(eq(navigationPaths.gameId, gameId));
  },

  /** 建立導航路徑 */
  async createNavigationPath(path: InsertNavigationPath): Promise<NavigationPath> {
    const [newPath] = await db.insert(navigationPaths).values(path).returning();
    return newPath;
  },

  /** 刪除導航路徑 */
  async deleteNavigationPath(id: number): Promise<void> {
    await db.delete(navigationPaths).where(eq(navigationPaths.id, id));
  },

  // ===== 成就 =====

  /** 取得遊戲的所有成就 */
  async getAchievements(gameId: string): Promise<Achievement[]> {
    return db.select().from(achievements).where(eq(achievements.gameId, gameId));
  },

  /** 根據 ID 取得成就 */
  async getAchievement(id: number): Promise<Achievement | undefined> {
    const result = await db.select().from(achievements).where(eq(achievements.id, id));
    return result[0];
  },

  /** 建立新成就 */
  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements).values(achievement).returning();
    return newAchievement;
  },

  /** 更新成就 */
  async updateAchievement(id: number, achievement: Partial<InsertAchievement>): Promise<Achievement | undefined> {
    const [updated] = await db.update(achievements).set(achievement).where(eq(achievements.id, id)).returning();
    return updated;
  },

  /** 刪除成就 */
  async deleteAchievement(id: number): Promise<void> {
    await db.delete(achievements).where(eq(achievements.id, id));
  },

  // ===== 玩家成就 =====

  /** 取得玩家的成就列表（可依遊戲篩選） */
  async getPlayerAchievements(userId: string, gameId?: string): Promise<PlayerAchievement[]> {
    if (gameId) {
      return db
        .select()
        .from(playerAchievements)
        .innerJoin(achievements, eq(playerAchievements.achievementId, achievements.id))
        .where(
          and(
            eq(playerAchievements.userId, userId),
            eq(achievements.gameId, gameId)
          )
        )
        .then(rows => rows.map(r => r.player_achievements));
    }
    return db.select().from(playerAchievements).where(eq(playerAchievements.userId, userId));
  },

  /** 解鎖成就 */
  async unlockAchievement(data: InsertPlayerAchievement): Promise<PlayerAchievement> {
    const [newPlayerAchievement] = await db.insert(playerAchievements).values(data).returning();
    return newPlayerAchievement;
  },

  /** 檢查玩家是否已擁有指定成就 */
  async hasAchievement(userId: string, achievementId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(playerAchievements)
      .where(
        and(
          eq(playerAchievements.userId, userId),
          eq(playerAchievements.achievementId, achievementId)
        )
      )
      .limit(1);
    return result.length > 0;
  },

  // ===== QR Code 查詢 =====

  /** 根據 QR Code 資料查詢地點 */
  async getLocationByQRCode(gameId: string, qrCodeData: string): Promise<Location | undefined> {
    const result = await db
      .select()
      .from(locations)
      .where(
        and(
          eq(locations.gameId, gameId),
          eq(locations.qrCodeData, qrCodeData)
        )
      );
    return result[0];
  },
};
