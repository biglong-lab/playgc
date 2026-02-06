// 排行榜相關的資料庫儲存方法
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  leaderboard,
  type LeaderboardEntry,
  type InsertLeaderboard,
} from "@shared/schema";

/** 排行榜儲存方法集合 */
export const leaderboardStorageMethods = {
  /** 取得排行榜（可依遊戲篩選，限制 100 筆） */
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
  },

  /** 建立排行榜項目 */
  async createLeaderboardEntry(entry: InsertLeaderboard): Promise<LeaderboardEntry> {
    const [newEntry] = await db.insert(leaderboard).values(entry).returning();
    return newEntry;
  },
};
