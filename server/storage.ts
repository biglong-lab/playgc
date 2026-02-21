// 主要儲存模組 - 整合所有子模組的方法
import {
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
  type GameChapter,
  type InsertGameChapter,
  type PlayerChapterProgress,
  type InsertPlayerChapterProgress,
  type GameChapterWithPages,
  type GameWithChapters,
  type RedeemCode,
  type InsertRedeemCode,
  type RedeemCodeUse,
  type InsertRedeemCodeUse,
  type Purchase,
  type InsertPurchase,
  type PaymentTransaction,
  type InsertPaymentTransaction,
} from "@shared/schema";

// 匯入各子模組的方法集合
import { userStorageMethods } from "./storage/user-storage";
import { gameStorageMethods } from "./storage/game-storage";
import { sessionStorageMethods } from "./storage/session-storage";
import { deviceStorageMethods } from "./storage/device-storage";
import { locationStorageMethods } from "./storage/location-storage";
import { leaderboardStorageMethods } from "./storage/leaderboard-storage";
import { chapterStorageMethods } from "./storage/chapter-storage";
import { purchaseStorageMethods } from "./storage/purchase-storage";

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

  // 章節方法
  getChapters(gameId: string): Promise<GameChapter[]>;
  getChapter(id: string): Promise<GameChapter | undefined>;
  getChapterWithPages(id: string): Promise<GameChapterWithPages | undefined>;
  createChapter(data: InsertGameChapter): Promise<GameChapter>;
  updateChapter(id: string, data: Partial<InsertGameChapter>): Promise<GameChapter | undefined>;
  deleteChapter(id: string): Promise<void>;
  reorderChapters(gameId: string, chapterIds: string[]): Promise<void>;
  getGameWithChapters(gameId: string): Promise<GameWithChapters | undefined>;
  getPlayerChapterProgress(userId: string, gameId: string): Promise<PlayerChapterProgress[]>;
  getChapterProgressByChapter(userId: string, chapterId: string): Promise<PlayerChapterProgress | undefined>;
  createChapterProgress(data: InsertPlayerChapterProgress): Promise<PlayerChapterProgress>;
  updateChapterProgress(id: string, data: Partial<InsertPlayerChapterProgress>): Promise<PlayerChapterProgress | undefined>;
  isChapterUnlocked(userId: string, chapterId: string): Promise<{ unlocked: boolean; reason?: string; detail?: Record<string, unknown> }>;
  unlockNextChapter(userId: string, gameId: string, completedChapterId: string): Promise<PlayerChapterProgress | null>;

  // 購買/票券方法
  getRedeemCodes(gameId: string): Promise<RedeemCode[]>;
  getRedeemCodeByCode(code: string): Promise<RedeemCode | undefined>;
  getRedeemCode(id: string): Promise<RedeemCode | undefined>;
  createRedeemCode(data: InsertRedeemCode): Promise<RedeemCode>;
  createRedeemCodes(data: InsertRedeemCode[]): Promise<RedeemCode[]>;
  updateRedeemCode(id: string, data: Partial<InsertRedeemCode>): Promise<RedeemCode | undefined>;
  deleteRedeemCode(id: string): Promise<void>;
  incrementRedeemCodeUsage(id: string): Promise<void>;
  getCodeUses(codeId: string): Promise<RedeemCodeUse[]>;
  hasUserRedeemedCode(codeId: string, userId: string): Promise<boolean>;
  createCodeUse(data: InsertRedeemCodeUse): Promise<RedeemCodeUse>;
  getPurchasesByUser(userId: string): Promise<Purchase[]>;
  getPurchasesByGame(gameId: string): Promise<Purchase[]>;
  getUserGamePurchase(userId: string, gameId: string): Promise<Purchase | undefined>;
  getUserChapterPurchase(userId: string, chapterId: string): Promise<Purchase | undefined>;
  getPurchase(id: string): Promise<Purchase | undefined>;
  createPurchase(data: InsertPurchase): Promise<Purchase>;
  updatePurchase(id: string, data: Partial<InsertPurchase>): Promise<Purchase | undefined>;
  getTransaction(id: string): Promise<PaymentTransaction | undefined>;
  getTransactionByRecurSession(sessionId: string): Promise<PaymentTransaction | undefined>;
  createTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  updateTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction | undefined>;
}

export class DatabaseStorage implements IStorage {
  // ===== 使用者方法 =====
  getUser = userStorageMethods.getUser;
  getUserByEmail = userStorageMethods.getUserByEmail;
  upsertUser = userStorageMethods.upsertUser;

  // ===== 遊戲方法 =====
  getGames = gameStorageMethods.getGames;
  getPublishedGames = gameStorageMethods.getPublishedGames;
  getGame = gameStorageMethods.getGame;
  getGameWithPages = gameStorageMethods.getGameWithPages;
  getGameWithDetails = gameStorageMethods.getGameWithDetails;
  createGame = gameStorageMethods.createGame;
  updateGame = gameStorageMethods.updateGame;
  deleteGame = gameStorageMethods.deleteGame;

  // ===== 頁面方法 =====
  getPages = gameStorageMethods.getPages;
  getPage = gameStorageMethods.getPage;
  createPage = gameStorageMethods.createPage;
  updatePage = gameStorageMethods.updatePage;
  deletePage = gameStorageMethods.deletePage;

  // ===== 道具方法 =====
  getItems = gameStorageMethods.getItems;
  getItem = gameStorageMethods.getItem;
  createItem = gameStorageMethods.createItem;
  updateItem = gameStorageMethods.updateItem;
  deleteItem = gameStorageMethods.deleteItem;

  // ===== 事件方法 =====
  getEvents = gameStorageMethods.getEvents;
  getEvent = gameStorageMethods.getEvent;
  createEvent = gameStorageMethods.createEvent;
  updateEvent = gameStorageMethods.updateEvent;
  deleteEvent = gameStorageMethods.deleteEvent;

  // ===== 工作階段方法 =====
  getSessions = sessionStorageMethods.getSessions;
  getSession = sessionStorageMethods.getSession;
  getActiveSessionsByGame = sessionStorageMethods.getActiveSessionsByGame;
  getActiveSessionByUserAndGame = sessionStorageMethods.getActiveSessionByUserAndGame;
  getSessionsByUser = sessionStorageMethods.getSessionsByUser;
  createSession = sessionStorageMethods.createSession;
  updateSession = sessionStorageMethods.updateSession;

  // ===== 玩家進度方法 =====
  getPlayerProgress = sessionStorageMethods.getPlayerProgress;
  createPlayerProgress = sessionStorageMethods.createPlayerProgress;
  updatePlayerProgress = sessionStorageMethods.updatePlayerProgress;

  // ===== 聊天訊息方法 =====
  getChatMessages = sessionStorageMethods.getChatMessages;
  createChatMessage = sessionStorageMethods.createChatMessage;

  // ===== Arduino 裝置方法 =====
  getArduinoDevices = deviceStorageMethods.getArduinoDevices;
  getArduinoDevice = deviceStorageMethods.getArduinoDevice;
  getArduinoDeviceByDeviceId = deviceStorageMethods.getArduinoDeviceByDeviceId;
  createArduinoDevice = deviceStorageMethods.createArduinoDevice;
  updateArduinoDevice = deviceStorageMethods.updateArduinoDevice;
  updateArduinoDeviceByDeviceId = deviceStorageMethods.updateArduinoDeviceByDeviceId;
  updateArduinoDeviceStatus = deviceStorageMethods.updateArduinoDeviceStatus;
  deleteArduinoDevice = deviceStorageMethods.deleteArduinoDevice;

  // ===== 射擊記錄方法 =====
  createShootingRecord = deviceStorageMethods.createShootingRecord;
  getShootingRecords = deviceStorageMethods.getShootingRecords;
  getShootingRecordsByDevice = deviceStorageMethods.getShootingRecordsByDevice;
  getShootingRecordStatistics = deviceStorageMethods.getShootingRecordStatistics;

  // ===== 裝置日誌方法 =====
  getDeviceLogs = deviceStorageMethods.getDeviceLogs;
  createDeviceLog = deviceStorageMethods.createDeviceLog;

  // ===== 排行榜方法 =====
  getLeaderboard = leaderboardStorageMethods.getLeaderboard;
  createLeaderboardEntry = leaderboardStorageMethods.createLeaderboardEntry;

  // ===== GPS 地點方法 =====
  getLocations = locationStorageMethods.getLocations;
  getLocation = locationStorageMethods.getLocation;
  createLocation = locationStorageMethods.createLocation;
  updateLocation = locationStorageMethods.updateLocation;
  deleteLocation = locationStorageMethods.deleteLocation;

  // ===== 玩家位置追蹤方法 =====
  createPlayerLocation = locationStorageMethods.createPlayerLocation;
  getPlayerCurrentLocation = locationStorageMethods.getPlayerCurrentLocation;
  getPlayerLocationHistory = locationStorageMethods.getPlayerLocationHistory;
  getTeamLocations = locationStorageMethods.getTeamLocations;

  // ===== 地點造訪方法 =====
  createLocationVisit = locationStorageMethods.createLocationVisit;
  getLocationVisits = locationStorageMethods.getLocationVisits;
  hasVisitedLocation = locationStorageMethods.hasVisitedLocation;

  // ===== 導航路徑方法 =====
  getNavigationPaths = locationStorageMethods.getNavigationPaths;
  createNavigationPath = locationStorageMethods.createNavigationPath;
  deleteNavigationPath = locationStorageMethods.deleteNavigationPath;

  // ===== 成就方法 =====
  getAchievements = locationStorageMethods.getAchievements;
  getAchievement = locationStorageMethods.getAchievement;
  createAchievement = locationStorageMethods.createAchievement;
  updateAchievement = locationStorageMethods.updateAchievement;
  deleteAchievement = locationStorageMethods.deleteAchievement;

  // ===== 玩家成就方法 =====
  getPlayerAchievements = locationStorageMethods.getPlayerAchievements;
  unlockAchievement = locationStorageMethods.unlockAchievement;
  hasAchievement = locationStorageMethods.hasAchievement;

  // ===== QR Code 查詢方法 =====
  getLocationByQRCode = locationStorageMethods.getLocationByQRCode;

  // ===== 章節方法 =====
  getChapters = chapterStorageMethods.getChapters;
  getChapter = chapterStorageMethods.getChapter;
  getChapterWithPages = chapterStorageMethods.getChapterWithPages;
  createChapter = chapterStorageMethods.createChapter;
  updateChapter = chapterStorageMethods.updateChapter;
  deleteChapter = chapterStorageMethods.deleteChapter;
  reorderChapters = chapterStorageMethods.reorderChapters;
  getGameWithChapters = chapterStorageMethods.getGameWithChapters;
  getPlayerChapterProgress = chapterStorageMethods.getPlayerChapterProgress;
  getChapterProgressByChapter = chapterStorageMethods.getChapterProgressByChapter;
  createChapterProgress = chapterStorageMethods.createChapterProgress;
  updateChapterProgress = chapterStorageMethods.updateChapterProgress;
  isChapterUnlocked = chapterStorageMethods.isChapterUnlocked;
  unlockNextChapter = chapterStorageMethods.unlockNextChapter;

  // ===== 購買/票券方法 =====
  getRedeemCodes = purchaseStorageMethods.getRedeemCodes;
  getRedeemCodeByCode = purchaseStorageMethods.getRedeemCodeByCode;
  getRedeemCode = purchaseStorageMethods.getRedeemCode;
  createRedeemCode = purchaseStorageMethods.createRedeemCode;
  createRedeemCodes = purchaseStorageMethods.createRedeemCodes;
  updateRedeemCode = purchaseStorageMethods.updateRedeemCode;
  deleteRedeemCode = purchaseStorageMethods.deleteRedeemCode;
  incrementRedeemCodeUsage = purchaseStorageMethods.incrementRedeemCodeUsage;
  getCodeUses = purchaseStorageMethods.getCodeUses;
  hasUserRedeemedCode = purchaseStorageMethods.hasUserRedeemedCode;
  createCodeUse = purchaseStorageMethods.createCodeUse;
  getPurchasesByUser = purchaseStorageMethods.getPurchasesByUser;
  getPurchasesByGame = purchaseStorageMethods.getPurchasesByGame;
  getUserGamePurchase = purchaseStorageMethods.getUserGamePurchase;
  getUserChapterPurchase = purchaseStorageMethods.getUserChapterPurchase;
  getPurchase = purchaseStorageMethods.getPurchase;
  createPurchase = purchaseStorageMethods.createPurchase;
  updatePurchase = purchaseStorageMethods.updatePurchase;
  getTransaction = purchaseStorageMethods.getTransaction;
  getTransactionByRecurSession = purchaseStorageMethods.getTransactionByRecurSession;
  createTransaction = purchaseStorageMethods.createTransaction;
  updateTransaction = purchaseStorageMethods.updateTransaction;
}

export const storage = new DatabaseStorage();
