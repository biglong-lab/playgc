// 排行榜相關的資料庫儲存方法
import { eq, desc } from "drizzle-orm";
import { db } from "../db";
import {
  leaderboard,
  gameSessions,
  playerProgress,
  users,
  type LeaderboardEntry,
  type InsertLeaderboard,
} from "@shared/schema";
import {
  getPlayerDisplayName,
  isAnonymousPlayer,
} from "@shared/lib/playerDisplay";

/** 擴充版排行榜資料：含顯示名稱（fallback 動態算）+ 匿名標記 + 頭像 */
export interface LeaderboardEntryExtended extends LeaderboardEntry {
  displayName: string;
  isAnonymousDisplay: boolean;
  profileImageUrl: string | null;
}

/** 排行榜儲存方法集合 */
export const leaderboardStorageMethods = {
  /** 取得排行榜（可依遊戲篩選，限制 100 筆）— 含 user JOIN 以產生顯示名稱 */
  async getLeaderboard(gameId?: string): Promise<LeaderboardEntryExtended[]> {
    // LEFT JOIN session + player_progress + users 取得使用者資訊
    // 舊資料可能沒 playerName/isAnonymous → 用 JOIN 到的 user 動態計算
    const query = db
      .select({
        entry: leaderboard,
        session: gameSessions,
        progress: playerProgress,
        user: users,
      })
      .from(leaderboard)
      .leftJoin(gameSessions, eq(gameSessions.id, leaderboard.sessionId))
      .leftJoin(playerProgress, eq(playerProgress.sessionId, leaderboard.sessionId))
      .leftJoin(users, eq(users.id, playerProgress.userId))
      .orderBy(desc(leaderboard.totalScore))
      .limit(100);

    const rows = gameId
      ? await query.where(eq(leaderboard.gameId, gameId))
      : await query;

    // 同一 sessionId 可能因 playerProgress 多筆（多人 session）JOIN 重複
    // 去重：保留同 entry id 的第一筆
    const seen = new Set<string>();
    const deduped: typeof rows = [];
    for (const r of rows) {
      if (!r.entry?.id || seen.has(r.entry.id)) continue;
      seen.add(r.entry.id);
      deduped.push(r);
    }

    return deduped.map((r) => {
      const source = {
        // snapshot 優先：leaderboard 建立當下存的 playerName
        playerName: r.entry.playerName || r.session?.playerName || null,
        firstName: r.user?.firstName,
        lastName: r.user?.lastName,
        email: r.user?.email,
      };
      // snapshot 有 isAnonymous → 用它；沒有 → 動態算
      const isAnonDisplay =
        r.entry.isAnonymous === 1 ||
        (r.entry.isAnonymous === null && isAnonymousPlayer(source));

      return {
        ...r.entry,
        displayName: r.entry.playerName || getPlayerDisplayName(source),
        isAnonymousDisplay: isAnonDisplay,
        profileImageUrl: r.user?.profileImageUrl || null,
      };
    });
  },

  /** 建立排行榜項目 */
  async createLeaderboardEntry(entry: InsertLeaderboard): Promise<LeaderboardEntry> {
    const [newEntry] = await db.insert(leaderboard).values(entry).returning();
    return newEntry;
  },
};
