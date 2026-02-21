// 遊戲工作階段、玩家進度、聊天訊息相關的資料庫儲存方法
import { eq, desc, and, lt, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameSessions,
  playerProgress,
  chatMessages,
  type GameSession,
  type InsertGameSession,
  type PlayerProgress,
  type InsertPlayerProgress,
  type ChatMessage,
  type InsertChatMessage,
} from "@shared/schema";

/** 工作階段儲存方法集合 */
export const sessionStorageMethods = {
  // ===== 工作階段 =====

  /** 取得所有工作階段（依開始時間倒序） */
  async getSessions(): Promise<GameSession[]> {
    return db.select().from(gameSessions).orderBy(desc(gameSessions.startedAt));
  },

  /** 根據 ID 取得工作階段 */
  async getSession(id: string): Promise<GameSession | undefined> {
    const result = await db.select().from(gameSessions).where(eq(gameSessions.id, id));
    return result[0];
  },

  /** 取得遊戲的進行中工作階段 */
  async getActiveSessionsByGame(gameId: string): Promise<GameSession[]> {
    return db
      .select()
      .from(gameSessions)
      .where(and(eq(gameSessions.gameId, gameId), eq(gameSessions.status, "playing")));
  },

  /** 取得使用者在某遊戲中的活躍工作階段（含進度） */
  async getActiveSessionByUserAndGame(
    userId: string,
    gameId: string
  ): Promise<{ session: GameSession; progress: PlayerProgress } | null> {
    // 先查詢進行中的工作階段
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

    // 若無進行中，則查詢最近的已完成工作階段
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
  },

  /** 取得使用者的所有工作階段（含進度） */
  async getSessionsByUser(
    userId: string
  ): Promise<{ session: GameSession; progress: PlayerProgress }[]> {
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
  },

  /** 建立新工作階段 */
  async createSession(session: InsertGameSession): Promise<GameSession> {
    const [newSession] = await db.insert(gameSessions).values(session).returning();
    return newSession;
  },

  /** 更新工作階段 */
  async updateSession(id: string, session: Partial<InsertGameSession>): Promise<GameSession | undefined> {
    const [updated] = await db.update(gameSessions).set(session).where(eq(gameSessions.id, id)).returning();
    return updated;
  },

  /** 批次放棄超時場次（超過 thresholdHours 小時仍在 playing 的場次） */
  async abandonStaleSessions(thresholdHours: number): Promise<GameSession[]> {
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);
    return db
      .update(gameSessions)
      .set({ status: "abandoned", completedAt: new Date() })
      .where(
        and(
          eq(gameSessions.status, "playing"),
          lt(gameSessions.startedAt, cutoff),
        ),
      )
      .returning();
  },

  // ===== 玩家進度 =====

  /** 取得工作階段的所有玩家進度 */
  async getPlayerProgress(sessionId: string): Promise<PlayerProgress[]> {
    return db.select().from(playerProgress).where(eq(playerProgress.sessionId, sessionId));
  },

  /** 建立玩家進度記錄 */
  async createPlayerProgress(progress: InsertPlayerProgress): Promise<PlayerProgress> {
    const [newProgress] = await db.insert(playerProgress).values(progress).returning();
    return newProgress;
  },

  /** 更新玩家進度 */
  async updatePlayerProgress(
    id: string,
    progress: Partial<InsertPlayerProgress>
  ): Promise<PlayerProgress | undefined> {
    const [updated] = await db
      .update(playerProgress)
      .set({ ...progress, updatedAt: new Date() })
      .where(eq(playerProgress.id, id))
      .returning();
    return updated;
  },

  // ===== 聊天訊息 =====

  /** 取得工作階段的聊天訊息（依時間排序） */
  async getChatMessages(sessionId: string): Promise<ChatMessage[]> {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt);
  },

  /** 建立聊天訊息 */
  async createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
    const [newMessage] = await db.insert(chatMessages).values(message).returning();
    return newMessage;
  },
};
