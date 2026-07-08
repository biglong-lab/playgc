// 遊戲工作階段、玩家進度、聊天訊息相關的資料庫儲存方法
import { eq, desc, and, lt, sql, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  gameSessions,
  playerProgress,
  chatMessages,
  games,
  teams,
  teamSessions,
  teamMembers,
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

  /** 取得所有工作階段（⚠️ 跨場域，僅限 super_admin 使用） */
  async getSessions(): Promise<GameSession[]> {
    return db.select().from(gameSessions).orderBy(desc(gameSessions.startedAt));
  },

  /** 取得指定場域的所有工作階段（🔒 場域隔離版本，JOIN games.fieldId） */
  async getSessionsByField(fieldId: string): Promise<GameSession[]> {
    const rows = await db
      .select({ session: gameSessions })
      .from(gameSessions)
      .innerJoin(games, eq(games.id, gameSessions.gameId))
      .where(eq(games.fieldId, fieldId))
      .orderBy(desc(gameSessions.startedAt));
    return rows.map((r) => r.session);
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

  /** 取得使用者在某遊戲中的活躍工作階段（含進度）
   *
   * 🆕 D2-c+ (2026-05-09)：邏輯改為「completed 優先」
   *   舊邏輯：playing 優先 → 玩家通關後又開新 session 中途離開、第三次進入會接續
   *           incomplete session、彈 ResumeDialog「上次玩到第 2 頁」造成困惑
   *   新邏輯：先查 completed（玩家曾通關過 → 進通關狀態、不再彈 dialog）
   *           沒 completed 才查 playing（接續未通關進度）
   *   行為：通關 = 結束。再進入 = 看到通關狀態。要重玩請點「重新開始」。
   */
  async getActiveSessionByUserAndGame(
    userId: string,
    gameId: string
  ): Promise<{ session: GameSession; progress: PlayerProgress } | null> {
    // 🐛 2026-07-06 修「保留進度離開後重進沒回中斷頁」（CHITO 複測 round 3 fail）：
    //   前次（07-03）改「取最新一筆 startedAt DESC limit 1」修好了 replay，
    //   但玩家會累積多個 session（POST /sessions 無去重、前端 queryFn 網路抖動又誤建空 session），
    //   最新那筆可能是「空的 playing（currentPageId=null）」→ 蓋掉真正有進度的 session → restore 回第 0 頁。
    //   新邏輯：改抓全部再於應用層決策——「有進度的 playing」優先於「空的最新 session」，
    //   同時保留 D2-c+「通關後顯示通關」意圖。
    const results = await db
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
          inArray(gameSessions.status, ["completed", "playing"])
        )
      )
      .orderBy(desc(gameSessions.startedAt));

    if (results.length === 0) return null;

    // 有進度 = currentPageId 有值（玩家已前進過至少一頁；換頁時才寫入）
    const hasProgress = (r: (typeof results)[number]) =>
      r.progress.currentPageId != null;

    const latest = results[0];

    // 1. 最新一筆是進行中且有進度 → 直接接續（重玩中 / 正常進行，優先於舊 completed）
    if (latest.session.status === "playing" && hasProgress(latest)) return latest;

    // 2. 否則優先找「有進度的最新 playing」——避免抖動誤建的空 playing 蓋掉真進度（本 bug 主因）
    const playingWithProgress = results.find(
      (r) => r.session.status === "playing" && hasProgress(r)
    );
    if (playingWithProgress) return playingWithProgress;

    // 3. 沒有任何有進度的 playing → 有通關紀錄就顯示通關（保留 D2-c+ 意圖）
    const completed = results.find((r) => r.session.status === "completed");
    if (completed) return completed;

    // 4. 全新遊戲（只有空 playing）→ 依最新一筆、restore 回第 0 頁正常開始
    return latest;
  },

  /**
   * 取得使用者的所有工作階段（含進度）
   *
   * 🆕 2026-05-02：多人遊戲完成偵測
   *   問題：團隊遊戲結束/解散後，gameSessions.status 仍是 "playing"，
   *         導致 Home 顯示「返回隊伍」但點進去隊伍已不存在。
   *   修法：LEFT JOIN team_sessions + teams + team_members(該玩家)，
   *         若 team 已 disbanded/completed 或玩家已 leftAt，
   *         覆寫 session.status = "completed"（保留 score 給 UI 顯示「再玩一次」）。
   *
   * 影響：
   *   - 此方法的所有 caller 都會看到「對該玩家而言有效」的 status
   *   - 單人遊戲不受影響（LEFT JOIN 不命中時 teamStatus / memberLeftAt 為 null）
   *   - 不寫回 DB（其他玩家可能還在玩同一個 session）
   */
  async getSessionsByUser(
    userId: string
  ): Promise<{ session: GameSession; progress: PlayerProgress }[]> {
    const results = await db
      .select({
        session: gameSessions,
        progress: playerProgress,
        teamStatus: teams.status,
        memberLeftAt: teamMembers.leftAt,
      })
      .from(playerProgress)
      .innerJoin(gameSessions, eq(playerProgress.sessionId, gameSessions.id))
      .leftJoin(teamSessions, eq(teamSessions.sessionId, gameSessions.id))
      .leftJoin(teams, eq(teams.id, teamSessions.teamId))
      .leftJoin(
        teamMembers,
        and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.teamId, teams.id),
        ),
      )
      .where(eq(playerProgress.userId, userId))
      .orderBy(desc(gameSessions.startedAt));

    return results.map(({ session, progress, teamStatus, memberLeftAt }) => {
      // 多人遊戲且還掛 "playing"：若 team 結束或玩家退出 → 對該玩家視為 completed
      const teamEnded =
        teamStatus === "disbanded" || teamStatus === "completed";
      if (
        session.status === "playing" &&
        (teamEnded || memberLeftAt !== null)
      ) {
        return {
          session: { ...session, status: "completed" },
          progress,
        };
      }
      return { session, progress };
    });
  },

  /** 建立新工作階段 */
  async createSession(session: InsertGameSession): Promise<GameSession> {
    const [newSession] = await db.insert(gameSessions).values(session).returning();
    return newSession;
  },

  /**
   * 🆕 2026-07-08 CHITO #f095652b：放棄該玩家在此遊戲的其他 solo playing session
   *
   * 根因：玩家會累積多個 playing session（重玩/網路抖動誤建），
   *   getActiveSessionByUserAndGame 的揀選規則可能撈回古早的幽靈進度
   *   （複測 fail：「保留進度重進卻問『從更以前的紀錄進度43繼續?』」）。
   * 修法：建新 session 時把舊的 solo playing 標 abandoned →
   *   同一玩家同一遊戲同時只有一個 playing session、揀選永遠唯一。
   *
   * ⚠️ 只動 solo：有 team_sessions 對應的多人 session 不碰
   *   （多人 session 全隊共用、生命週期由 team lifecycle 管理）。
   */
  async abandonOtherPlayingSessionsForUser(
    userId: string,
    gameId: string,
    excludeSessionId: string,
  ): Promise<number> {
    // 找候選：此玩家有 progress 的此遊戲 playing session（排除新建的那筆）
    const candidates = await db
      .select({ id: gameSessions.id, teamSessionId: teamSessions.id })
      .from(gameSessions)
      .innerJoin(playerProgress, eq(playerProgress.sessionId, gameSessions.id))
      .leftJoin(teamSessions, eq(teamSessions.sessionId, gameSessions.id))
      .where(
        and(
          eq(playerProgress.userId, userId),
          eq(gameSessions.gameId, gameId),
          eq(gameSessions.status, "playing"),
        ),
      );

    const targetIds = candidates
      .filter((c) => c.id !== excludeSessionId && c.teamSessionId == null)
      .map((c) => c.id);
    if (targetIds.length === 0) return 0;

    await db
      .update(gameSessions)
      .set({ status: "abandoned", completedAt: new Date() })
      .where(inArray(gameSessions.id, targetIds));
    return targetIds.length;
  },

  /** 更新工作階段 */
  async updateSession(id: string, session: Partial<InsertGameSession>): Promise<GameSession | undefined> {
    const [updated] = await db.update(gameSessions).set(session).where(eq(gameSessions.id, id)).returning();
    return updated;
  },

  /**
   * 批次放棄超時場次（超過 thresholdHours 小時仍在 playing 的場次）
   * @param thresholdHours 超時閾值（小時）
   * @param fieldId 可選 — 只清理此場域的 sessions（場域 admin 必須傳）
   */
  async abandonStaleSessions(
    thresholdHours: number,
    fieldId?: string,
  ): Promise<GameSession[]> {
    const cutoff = new Date(Date.now() - thresholdHours * 60 * 60 * 1000);

    // 場域過濾：JOIN games 取出對應 fieldId 的 session ids
    if (fieldId) {
      const targetIds = await db
        .select({ id: gameSessions.id })
        .from(gameSessions)
        .innerJoin(games, eq(games.id, gameSessions.gameId))
        .where(
          and(
            eq(games.fieldId, fieldId),
            eq(gameSessions.status, "playing"),
            lt(gameSessions.startedAt, cutoff),
          ),
        );

      if (targetIds.length === 0) return [];

      return db
        .update(gameSessions)
        .set({ status: "abandoned", completedAt: new Date() })
        .where(inArray(gameSessions.id, targetIds.map((r) => r.id)))
        .returning();
    }

    // 無 fieldId（super_admin）→ 清全部
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

  /**
   * 取得單一玩家在指定工作階段的進度（多人併發熱路徑）
   * 用 idx_player_progress_session_user 複合 index 直接定位，避免撈整個 session 的全部玩家
   */
  async getPlayerProgressByUser(
    sessionId: string,
    userId: string,
  ): Promise<PlayerProgress | undefined> {
    const rows = await db
      .select()
      .from(playerProgress)
      .where(
        and(
          eq(playerProgress.sessionId, sessionId),
          eq(playerProgress.userId, userId),
        ),
      )
      .limit(1);
    return rows[0];
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
