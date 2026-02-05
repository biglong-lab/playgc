import { eq, desc, and, sql, gte, asc, lte } from "drizzle-orm";
import { db } from "./db";
import {
  users,
  games,
  pages,
  items,
  events,
  gameSessions,
  playerProgress,
  chatMessages,
  arduinoDevices,
  shootingRecords,
  leaderboard,
  deviceLogs,
  locations,
  playerLocations,
  locationVisits,
  navigationPaths,
  achievements,
  playerAchievements,
  type User,
  type UpsertUser,
  type Game,
  type InsertGame,
  type Page,
  type InsertPage,
  type Item,
  type InsertItem,
  type GameEvent,
  type InsertEvent,
  type GameSession,
  type InsertGameSession,
  type PlayerProgress,
  type InsertPlayerProgress,
  type ChatMessage,
  type InsertChatMessage,
  type ArduinoDevice,
  type InsertArduinoDevice,
  type ShootingRecord,
  type InsertShootingRecord,
  type LeaderboardEntry,
  type InsertLeaderboard,
  type DeviceLog,
  type InsertDeviceLog,
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
  type GameWithPages,
  type GameWithDetails,
} from "@shared/schema";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  getGames(): Promise<Game[]>;
  getPublishedGames(): Promise<Game[]>;
  getGame(id: string): Promise<Game | undefined>;
  getGameWithPages(id: string): Promise<GameWithPages | undefined>;
  getGameWithDetails(id: string): Promise<GameWithDetails | undefined>;
  createGame(game: InsertGame): Promise<Game>;
  updateGame(id: string, game: Partial<InsertGame>): Promise<Game | undefined>;
  deleteGame(id: string): Promise<void>;

  getPages(gameId: string): Promise<Page[]>;
  getPage(id: string): Promise<Page | undefined>;
  createPage(page: InsertPage): Promise<Page>;
  updatePage(id: string, page: Partial<InsertPage>): Promise<Page | undefined>;
  deletePage(id: string): Promise<void>;

  getItems(gameId: string): Promise<Item[]>;
  getItem(id: string): Promise<Item | undefined>;
  createItem(item: InsertItem): Promise<Item>;
  updateItem(id: string, item: Partial<InsertItem>): Promise<Item | undefined>;
  deleteItem(id: string): Promise<void>;

  getEvents(gameId: string): Promise<GameEvent[]>;
  getEvent(id: string): Promise<GameEvent | undefined>;
  createEvent(event: InsertEvent): Promise<GameEvent>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<GameEvent | undefined>;
  deleteEvent(id: string): Promise<void>;

  getSessions(): Promise<GameSession[]>;
  getSession(id: string): Promise<GameSession | undefined>;
  getActiveSessionsByGame(gameId: string): Promise<GameSession[]>;
  getActiveSessionByUserAndGame(userId: string, gameId: string): Promise<{ session: GameSession; progress: PlayerProgress } | null>;
  getSessionsByUser(userId: string): Promise<{ session: GameSession; progress: PlayerProgress }[]>;
  createSession(session: InsertGameSession): Promise<GameSession>;
  updateSession(id: string, session: Partial<InsertGameSession>): Promise<GameSession | undefined>;

  getPlayerProgress(sessionId: string): Promise<PlayerProgress[]>;
  createPlayerProgress(progress: InsertPlayerProgress): Promise<PlayerProgress>;
  updatePlayerProgress(id: string, progress: Partial<InsertPlayerProgress>): Promise<PlayerProgress | undefined>;

  getChatMessages(sessionId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;

  getArduinoDevices(): Promise<ArduinoDevice[]>;
  getArduinoDevice(id: string): Promise<ArduinoDevice | undefined>;
  getArduinoDeviceByDeviceId(deviceId: string): Promise<ArduinoDevice | undefined>;
  createArduinoDevice(device: InsertArduinoDevice): Promise<ArduinoDevice>;
  updateArduinoDevice(id: string, device: Partial<InsertArduinoDevice>): Promise<ArduinoDevice | undefined>;
  updateArduinoDeviceByDeviceId(deviceId: string, device: Partial<InsertArduinoDevice>): Promise<ArduinoDevice | undefined>;
  updateArduinoDeviceStatus(id: string, status: string): Promise<ArduinoDevice | undefined>;
  deleteArduinoDevice(id: string): Promise<void>;

  createShootingRecord(record: InsertShootingRecord): Promise<ShootingRecord>;
  getShootingRecords(sessionId: string): Promise<ShootingRecord[]>;
  getShootingRecordsByDevice(deviceId: string, limit?: number): Promise<ShootingRecord[]>;
  getShootingRecordStatistics(deviceId: string, days?: number): Promise<{
    totalHits: number;
    totalScore: number;
    avgScore: number;
  }>;

  getDeviceLogs(deviceId: string, limit?: number, logType?: string): Promise<DeviceLog[]>;
  createDeviceLog(log: InsertDeviceLog): Promise<DeviceLog>;

  getLeaderboard(gameId?: string): Promise<LeaderboardEntry[]>;
  createLeaderboardEntry(entry: InsertLeaderboard): Promise<LeaderboardEntry>;

  // GPS Location methods
  getLocations(gameId: string, filters?: { type?: string; status?: string }): Promise<Location[]>;
  getLocation(id: number): Promise<Location | undefined>;
  createLocation(location: InsertLocation): Promise<Location>;
  updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location | undefined>;
  deleteLocation(id: number): Promise<void>;

  // Player Location tracking methods
  createPlayerLocation(location: InsertPlayerLocation): Promise<PlayerLocation>;
  getPlayerCurrentLocation(sessionId: string, playerId: string): Promise<PlayerLocation | undefined>;
  getPlayerLocationHistory(sessionId: string, playerId: string, options?: { startTime?: Date; endTime?: Date; limit?: number }): Promise<PlayerLocation[]>;
  getTeamLocations(sessionId: string): Promise<PlayerLocation[]>;

  // Location Visit methods
  createLocationVisit(visit: InsertLocationVisit): Promise<LocationVisit>;
  getLocationVisits(sessionId: string, playerId: string): Promise<LocationVisit[]>;
  hasVisitedLocation(locationId: number, sessionId: string, playerId: string): Promise<boolean>;

  // Navigation Path methods
  getNavigationPaths(gameId: string): Promise<NavigationPath[]>;
  createNavigationPath(path: InsertNavigationPath): Promise<NavigationPath>;
  deleteNavigationPath(id: number): Promise<void>;

  // Achievement methods
  getAchievements(gameId: string): Promise<Achievement[]>;
  getAchievement(id: number): Promise<Achievement | undefined>;
  createAchievement(achievement: InsertAchievement): Promise<Achievement>;
  updateAchievement(id: number, achievement: Partial<InsertAchievement>): Promise<Achievement | undefined>;
  deleteAchievement(id: number): Promise<void>;
  
  // Player Achievement methods
  getPlayerAchievements(userId: string, gameId?: string): Promise<PlayerAchievement[]>;
  unlockAchievement(data: InsertPlayerAchievement): Promise<PlayerAchievement>;
  hasAchievement(userId: string, achievementId: number): Promise<boolean>;

  // Location by QR Code
  getLocationByQRCode(gameId: string, qrCodeData: string): Promise<Location | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First try to find existing user by email
    const existingUser = await this.getUserByEmail(userData.email);
    
    if (existingUser) {
      // Update existing user
      const [updated] = await db
        .update(users)
        .set({
          firstName: userData.firstName || existingUser.firstName,
          lastName: userData.lastName || existingUser.lastName,
          profileImageUrl: userData.profileImageUrl || existingUser.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(users.id, existingUser.id))
        .returning();
      return updated;
    }
    
    // Insert new user
    const [newUser] = await db
      .insert(users)
      .values(userData)
      .returning();
    return newUser;
  }

  async getGames(): Promise<Game[]> {
    return db.select().from(games).orderBy(desc(games.createdAt));
  }

  async getPublishedGames(): Promise<Game[]> {
    return db.select().from(games).where(eq(games.status, "published")).orderBy(desc(games.createdAt));
  }

  async getGame(id: string): Promise<Game | undefined> {
    const result = await db.select().from(games).where(eq(games.id, id));
    return result[0];
  }

  async getGameWithPages(id: string): Promise<GameWithPages | undefined> {
    const game = await this.getGame(id);
    if (!game) return undefined;
    
    const gamePages = await db.select().from(pages).where(eq(pages.gameId, id)).orderBy(pages.pageOrder);
    return { ...game, pages: gamePages };
  }

  async getGameWithDetails(id: string): Promise<GameWithDetails | undefined> {
    const game = await this.getGame(id);
    if (!game) return undefined;
    
    const [gamePages, gameItems, gameEvents] = await Promise.all([
      db.select().from(pages).where(eq(pages.gameId, id)).orderBy(pages.pageOrder),
      db.select().from(items).where(eq(items.gameId, id)),
      db.select().from(events).where(eq(events.gameId, id)),
    ]);
    
    return { ...game, pages: gamePages, items: gameItems, events: gameEvents };
  }

  async createGame(game: InsertGame): Promise<Game> {
    const [newGame] = await db.insert(games).values(game).returning();
    return newGame;
  }

  async updateGame(id: string, game: Partial<InsertGame>): Promise<Game | undefined> {
    const [updated] = await db
      .update(games)
      .set({ ...game, updatedAt: new Date() })
      .where(eq(games.id, id))
      .returning();
    return updated;
  }

  async deleteGame(id: string): Promise<void> {
    await db.delete(games).where(eq(games.id, id));
  }

  async getPages(gameId: string): Promise<Page[]> {
    return db.select().from(pages).where(eq(pages.gameId, gameId)).orderBy(pages.pageOrder);
  }

  async getPage(id: string): Promise<Page | undefined> {
    const result = await db.select().from(pages).where(eq(pages.id, id));
    return result[0];
  }

  async createPage(page: InsertPage): Promise<Page> {
    const [newPage] = await db.insert(pages).values(page).returning();
    return newPage;
  }

  async updatePage(id: string, page: Partial<InsertPage>): Promise<Page | undefined> {
    const [updated] = await db.update(pages).set(page).where(eq(pages.id, id)).returning();
    return updated;
  }

  async deletePage(id: string): Promise<void> {
    await db.delete(pages).where(eq(pages.id, id));
  }

  async getItems(gameId: string): Promise<Item[]> {
    return db.select().from(items).where(eq(items.gameId, gameId));
  }

  async getItem(id: string): Promise<Item | undefined> {
    const result = await db.select().from(items).where(eq(items.id, id));
    return result[0];
  }

  async createItem(item: InsertItem): Promise<Item> {
    const [newItem] = await db.insert(items).values(item).returning();
    return newItem;
  }

  async updateItem(id: string, item: Partial<InsertItem>): Promise<Item | undefined> {
    const [updated] = await db.update(items).set(item).where(eq(items.id, id)).returning();
    return updated;
  }

  async deleteItem(id: string): Promise<void> {
    await db.delete(items).where(eq(items.id, id));
  }

  async getEvents(gameId: string): Promise<GameEvent[]> {
    return db.select().from(events).where(eq(events.gameId, gameId));
  }

  async getEvent(id: string): Promise<GameEvent | undefined> {
    const result = await db.select().from(events).where(eq(events.id, id));
    return result[0];
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<GameEvent | undefined> {
    const [updated] = await db.update(events).set(event).where(eq(events.id, id)).returning();
    return updated;
  }

  async createEvent(event: InsertEvent): Promise<GameEvent> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  async getSessions(): Promise<GameSession[]> {
    return db.select().from(gameSessions).orderBy(desc(gameSessions.startedAt));
  }

  async getSession(id: string): Promise<GameSession | undefined> {
    const result = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
    return result[0];
  }

  async getActiveSessionsByGame(gameId: string): Promise<GameSession[]> {
    return db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.gameId, gameId), eq(gameSessions.status, "playing")));
  }

  async getActiveSessionByUserAndGame(userId: string, gameId: string): Promise<{ session: GameSession; progress: PlayerProgress } | null> {
    // First try to find a playing session for this user and game
    const playingResults = await db
      .select({
        session: gameSessions,
        progress: playerProgress,
      })
      .from(playerProgress)
      .innerJoin(gameSessions, eq(playerProgress.sessionId, gameSessions.id))
      .where(
        and(
          eq(playerProgress.userId, userId),
          eq(gameSessions.gameId, gameId),
          eq(gameSessions.status, "playing")
        )
      )
      .orderBy(desc(gameSessions.startedAt))
      .limit(1);

    if (playingResults.length > 0) {
      return playingResults[0];
    }

    // If no playing session, check for the most recent completed session
    const completedResults = await db
      .select({
        session: gameSessions,
        progress: playerProgress,
      })
      .from(playerProgress)
      .innerJoin(gameSessions, eq(playerProgress.sessionId, gameSessions.id))
      .where(
        and(
          eq(playerProgress.userId, userId),
          eq(gameSessions.gameId, gameId),
          eq(gameSessions.status, "completed")
        )
      )
      .orderBy(desc(gameSessions.startedAt))
      .limit(1);

    if (completedResults.length > 0) {
      return completedResults[0];
    }

    return null;
  }

  async getSessionsByUser(userId: string): Promise<{ session: GameSession; progress: PlayerProgress }[]> {
    const results = await db
      .select({
        session: gameSessions,
        progress: playerProgress,
      })
      .from(playerProgress)
      .innerJoin(gameSessions, eq(playerProgress.sessionId, gameSessions.id))
      .where(eq(playerProgress.userId, userId))
      .orderBy(desc(gameSessions.startedAt));
    
    return results;
  }

  async createSession(session: InsertGameSession): Promise<GameSession> {
    const [newSession] = await db.insert(gameSessions).values(session).returning();
    return newSession;
  }

  async updateSession(id: string, session: Partial<InsertGameSession>): Promise<GameSession | undefined> {
    const [updated] = await db.update(gameSessions).set(session).where(eq(gameSessions.id, id)).returning();
    return updated;
  }

  async getPlayerProgress(sessionId: string): Promise<PlayerProgress[]> {
    return db.select().from(playerProgress).where(eq(playerProgress.sessionId, sessionId));
  }

  async createPlayerProgress(progress: InsertPlayerProgress): Promise<PlayerProgress> {
    const [newProgress] = await db.insert(playerProgress).values(progress).returning();
    return newProgress;
  }

  async updatePlayerProgress(id: string, progress: Partial<InsertPlayerProgress>): Promise<PlayerProgress | undefined> {
    const [updated] = await db
      .update(playerProgress)
      .set({ ...progress, updatedAt: new Date() })
      .where(eq(playerProgress.id, id))
      .returning();
    return updated;
  }

  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, sessionId)).orderBy(chatMessages.createdAt);
  }

  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  }

  async getArduinoDevices(): Promise<ArduinoDevice[]> {
    return db.select().from(arduinoDevices).orderBy(desc(arduinoDevices.createdAt));
  }

  async getArduinoDevice(id: string): Promise<ArduinoDevice | undefined> {
    const result = await db.select().from(arduinoDevices).where(eq(arduinoDevices.id, id));
    return result[0];
  }

  async getArduinoDeviceByDeviceId(deviceId: string): Promise<ArduinoDevice | undefined> {
    const result = await db.select().from(arduinoDevices).where(eq(arduinoDevices.deviceId, deviceId));
    return result[0];
  }

  async createArduinoDevice(device: InsertArduinoDevice): Promise<ArduinoDevice> {
    const [newDevice] = await db.insert(arduinoDevices).values(device).returning();
    return newDevice;
  }

  async updateArduinoDevice(id: string, device: Partial<InsertArduinoDevice>): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(arduinoDevices.id, id))
      .returning();
    return updated;
  }

  async updateArduinoDeviceByDeviceId(deviceId: string, device: Partial<InsertArduinoDevice>): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ ...device, updatedAt: new Date() })
      .where(eq(arduinoDevices.deviceId, deviceId))
      .returning();
    return updated;
  }

  async updateArduinoDeviceStatus(id: string, status: string): Promise<ArduinoDevice | undefined> {
    const [updated] = await db
      .update(arduinoDevices)
      .set({ status, lastHeartbeat: new Date(), updatedAt: new Date() })
      .where(eq(arduinoDevices.id, id))
      .returning();
    return updated;
  }

  async deleteArduinoDevice(id: string): Promise<void> {
    await db.delete(arduinoDevices).where(eq(arduinoDevices.id, id));
  }

  async createShootingRecord(record: InsertShootingRecord): Promise<ShootingRecord> {
    const [newRecord] = await db.insert(shootingRecords).values(record).returning();
    return newRecord;
  }

  async getShootingRecords(sessionId: string): Promise<ShootingRecord[]> {
    return db.select().from(shootingRecords).where(eq(shootingRecords.sessionId, sessionId));
  }

  async getShootingRecordsByDevice(deviceId: string, limit: number = 100): Promise<ShootingRecord[]> {
    return db
      .select()
      .from(shootingRecords)
      .where(eq(shootingRecords.deviceId, deviceId))
      .orderBy(desc(shootingRecords.hitTimestamp))
      .limit(limit);
  }

  async getShootingRecordStatistics(deviceId: string, days: number = 7): Promise<{
    totalHits: number;
    totalScore: number;
    avgScore: number;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const records = await db
      .select()
      .from(shootingRecords)
      .where(
        and(
          eq(shootingRecords.deviceId, deviceId),
          gte(shootingRecords.hitTimestamp, startDate)
        )
      );
    
    const totalHits = records.length;
    const totalScore = records.reduce((sum, r) => sum + (r.score || r.hitScore || 0), 0);
    const avgScore = totalHits > 0 ? Math.round((totalScore / totalHits) * 100) / 100 : 0;
    
    return { totalHits, totalScore, avgScore };
  }

  async getDeviceLogs(deviceId: string, limit: number = 100, logType?: string): Promise<DeviceLog[]> {
    if (logType) {
      return db
        .select()
        .from(deviceLogs)
        .where(
          and(
            eq(deviceLogs.deviceId, deviceId),
            eq(deviceLogs.logType, logType)
          )
        )
        .orderBy(desc(deviceLogs.createdAt))
        .limit(limit);
    }
    return db
      .select()
      .from(deviceLogs)
      .where(eq(deviceLogs.deviceId, deviceId))
      .orderBy(desc(deviceLogs.createdAt))
      .limit(limit);
  }

  async createDeviceLog(log: InsertDeviceLog): Promise<DeviceLog> {
    const [newLog] = await db.insert(deviceLogs).values(log).returning();
    return newLog;
  }

  async getLeaderboard(gameId?: string): Promise<LeaderboardEntry[]> {
    if (gameId) {
      return db
        .select()
        .from(leaderboard)
        .where(eq(leaderboard.gameId, gameId))
        .orderBy(desc(leaderboard.totalScore))
        .limit(100);
    }
    return db.select().from(leaderboard).orderBy(desc(leaderboard.totalScore)).limit(100);
  }

  async createLeaderboardEntry(entry: InsertLeaderboard): Promise<LeaderboardEntry> {
    const [newEntry] = await db.insert(leaderboard).values(entry).returning();
    return newEntry;
  }

  // GPS Location methods
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
  }

  async getLocation(id: number): Promise<Location | undefined> {
    const result = await db.select().from(locations).where(eq(locations.id, id));
    return result[0];
  }

  async createLocation(location: InsertLocation): Promise<Location> {
    const [newLocation] = await db.insert(locations).values(location).returning();
    return newLocation;
  }

  async updateLocation(id: number, location: Partial<InsertLocation>): Promise<Location | undefined> {
    const [updated] = await db
      .update(locations)
      .set({ ...location, updatedAt: new Date() })
      .where(eq(locations.id, id))
      .returning();
    return updated;
  }

  async deleteLocation(id: number): Promise<void> {
    await db.delete(locations).where(eq(locations.id, id));
  }

  // Player Location tracking methods
  async createPlayerLocation(location: InsertPlayerLocation): Promise<PlayerLocation> {
    const [newLocation] = await db.insert(playerLocations).values(location).returning();
    return newLocation;
  }

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
  }

  async getPlayerLocationHistory(
    sessionId: string,
    playerId: string,
    options?: { startTime?: Date; endTime?: Date; limit?: number }
  ): Promise<PlayerLocation[]> {
    let conditions = [
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
  }

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
  }

  // Location Visit methods
  async createLocationVisit(visit: InsertLocationVisit): Promise<LocationVisit> {
    const [newVisit] = await db.insert(locationVisits).values(visit).returning();
    return newVisit;
  }

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
  }

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
  }

  // Navigation Path methods
  async getNavigationPaths(gameId: string): Promise<NavigationPath[]> {
    return db.select().from(navigationPaths).where(eq(navigationPaths.gameId, gameId));
  }

  async createNavigationPath(path: InsertNavigationPath): Promise<NavigationPath> {
    const [newPath] = await db.insert(navigationPaths).values(path).returning();
    return newPath;
  }

  async deleteNavigationPath(id: number): Promise<void> {
    await db.delete(navigationPaths).where(eq(navigationPaths.id, id));
  }

  // Achievement methods
  async getAchievements(gameId: string): Promise<Achievement[]> {
    return db.select().from(achievements).where(eq(achievements.gameId, gameId));
  }

  async getAchievement(id: number): Promise<Achievement | undefined> {
    const result = await db.select().from(achievements).where(eq(achievements.id, id));
    return result[0];
  }

  async createAchievement(achievement: InsertAchievement): Promise<Achievement> {
    const [newAchievement] = await db.insert(achievements).values(achievement).returning();
    return newAchievement;
  }

  async updateAchievement(id: number, achievement: Partial<InsertAchievement>): Promise<Achievement | undefined> {
    const [updated] = await db.update(achievements).set(achievement).where(eq(achievements.id, id)).returning();
    return updated;
  }

  async deleteAchievement(id: number): Promise<void> {
    await db.delete(achievements).where(eq(achievements.id, id));
  }

  // Player Achievement methods
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
  }

  async unlockAchievement(data: InsertPlayerAchievement): Promise<PlayerAchievement> {
    const [newPlayerAchievement] = await db.insert(playerAchievements).values(data).returning();
    return newPlayerAchievement;
  }

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
  }

  // Location by QR Code
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
  }
}

export const storage = new DatabaseStorage();
