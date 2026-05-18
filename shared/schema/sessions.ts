// 場次 (Sessions) - 遊戲場次、玩家進度、聊天訊息
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games, pages } from "./games";
import { teams } from "./teams";
import { gameChapters } from "./chapters";

// ============================================================================
// Game Sessions table - Active game instances
// ============================================================================
export const gameSessions = pgTable(
  "game_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id").references(() => games.id),
    teamName: varchar("team_name", { length: 100 }),
    /** 🆕 玩家自訂暱稱（匿名 Firebase 登入無 firstName 時的替代）
     *  顯示優先序：users.firstName/lastName > users.email(非 firebase.local) > session.playerName > "玩家"
     */
    playerName: varchar("player_name", { length: 50 }),
    playerCount: integer("player_count").default(1),
    status: varchar("status", { length: 20 }).default("playing"), // playing, completed, abandoned
    score: integer("score").default(0),
    currentChapterId: varchar("current_chapter_id").references(() => gameChapters.id, { onDelete: "set null" }),
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    // 🆕 ADR-0004 (2026-05-02)：HostScreen 主控大螢幕模式
    //   host_mode = true：此 session 是 HostScreen 模式，需 hostToken 才能進大螢幕
    //   host_token：admin 簽發的 12 小時有效 token，給 /host/:sessionId?token=xxx 驗證
    //   host_token_expires_at：token 過期時間（過期需 admin 重新簽發）
    hostMode: boolean("host_mode").default(false).notNull(),
    hostToken: varchar("host_token"),
    hostTokenExpiresAt: timestamp("host_token_expires_at"),
    // 🆕 2026-05-19 Phase C：遊戲重置記錄
    //   業主在 /admin/troubleshoot/reset 對出狀況的玩家重新開始一次
    //   reset_history append-only、保留完整重置軌跡（含原因、操作者、from 章節/分數）
    resetCount: integer("reset_count").default(0).notNull(),
    resetHistory: jsonb("reset_history").default([]).notNull(),
  },
  (table) => [index("idx_sessions_status").on(table.status, table.startedAt)]
);

/** Reset history entry 結構 */
export interface SessionResetEntry {
  /** ISO timestamp */
  at: string;
  /** 操作 admin id */
  byAdminId: string;
  /** 操作 admin 顯示名 */
  byAdminName?: string;
  /** 重置原因（必填、≥ 10 字）*/
  reason: string;
  /** 重置前的章節 id */
  fromChapterId?: string | null;
  /** 重置前的分數 */
  fromScore: number;
  /** 重置前狀態 */
  fromStatus: string;
}

// ============================================================================
// Player Progress table - Individual player state in a session
// ============================================================================
export const playerProgress = pgTable(
  "player_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    userId: varchar("user_id").references(() => users.id),
    currentPageId: varchar("current_page_id").references(() => pages.id, { onDelete: "set null" }),
    score: integer("score").default(0), // Player's individual score
    inventory: jsonb("inventory").default([]), // Array of item IDs
    variables: jsonb("variables").default({}), // Game variables
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    // 多人併發優化：按 session + user 直接定位玩家進度（避免全 session 掃描）
    index("idx_player_progress_session_user").on(table.sessionId, table.userId),
  ],
);

// ============================================================================
// Chat Messages table - Real-time team chat
// ============================================================================
export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    sessionId: varchar("session_id")
      .references(() => gameSessions.id, { onDelete: "cascade" })
      .notNull(),
    teamId: varchar("team_id").references(() => teams.id, { onDelete: "cascade" }), // Optional: for team chat
    userId: varchar("user_id").references(() => users.id),
    message: text("message").notNull(),
    messageType: varchar("message_type", { length: 20 }).default("text"), // text, system, location, vote
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [index("idx_chat_messages_session").on(table.sessionId, table.createdAt)]
);

// Game Session schemas
export const insertGameSessionSchema = createInsertSchema(gameSessions).omit({
  id: true,
  startedAt: true,
  completedAt: true,
});
export type InsertGameSession = z.infer<typeof insertGameSessionSchema>;
export type GameSession = typeof gameSessions.$inferSelect;

// Player Progress schemas
export const insertPlayerProgressSchema = createInsertSchema(playerProgress).omit({
  id: true,
  updatedAt: true,
});
export type InsertPlayerProgress = z.infer<typeof insertPlayerProgressSchema>;
export type PlayerProgress = typeof playerProgress.$inferSelect;

// Chat Message schemas
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

