// 對戰系統 (Matches) - 競爭/接力模式核心表
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { games } from "./games";
import { gameChapters } from "./chapters";
import { teams } from "./teams";
import { users } from "./users";
import { gameSessions } from "./sessions";

// 對戰狀態
export const matchStatusEnum = ["waiting", "countdown", "playing", "finished", "cancelled"] as const;
export type MatchStatus = typeof matchStatusEnum[number];

// 計分模式
export const scoringModeEnum = ["speed", "accuracy", "combined"] as const;
export type ScoringMode = typeof scoringModeEnum[number];

// 接力傳棒方式
export const handoffMethodEnum = ["manual", "auto_on_complete", "timed"] as const;
export type HandoffMethod = typeof handoffMethodEnum[number];

// 對戰設定介面
export interface MatchSettings {
  readonly timeLimit?: number; // 秒
  readonly scoringMode: ScoringMode;
  readonly showRealTimeRanking: boolean;
  readonly maxParticipants?: number;
  readonly countdownSeconds?: number;
}

// 接力設定介面
export interface RelayConfig {
  readonly segmentCount: number;
  readonly handoffMethod: HandoffMethod;
  readonly segmentTimeLimit?: number; // 每段時間限制（秒）
  readonly allowBacktrack: boolean;
}

// ============================================================================
// 對戰主表
// ============================================================================
export const gameMatches = pgTable("game_matches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  gameId: varchar("game_id").notNull().references(() => games.id, { onDelete: "cascade" }),
  chapterId: varchar("chapter_id").references(() => gameChapters.id),
  creatorId: varchar("creator_id").references(() => users.id),

  // 對戰模式：competitive = 競爭, relay = 接力
  matchMode: varchar("match_mode", { length: 20 }).notNull().default("competitive"),
  status: varchar("status", { length: 20 }).notNull().default("waiting"),

  // 設定
  settings: jsonb("settings").$type<MatchSettings>().default({
    scoringMode: "combined",
    showRealTimeRanking: true,
    countdownSeconds: 3,
  }),
  relayConfig: jsonb("relay_config").$type<RelayConfig>(),

  maxTeams: integer("max_teams").default(10),
  accessCode: varchar("access_code", { length: 10 }),

  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_game_matches_game_id").on(table.gameId),
  index("idx_game_matches_status").on(table.status),
  index("idx_game_matches_access_code").on(table.accessCode),
]);

// ============================================================================
// 對戰參與者表
// ============================================================================
export const matchParticipants = pgTable("match_participants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  matchId: varchar("match_id").notNull().references(() => gameMatches.id, { onDelete: "cascade" }),
  teamId: varchar("team_id").references(() => teams.id),
  userId: varchar("user_id").references(() => users.id),
  sessionId: varchar("session_id").references(() => gameSessions.id),

  // 分數追蹤
  currentScore: integer("current_score").default(0).notNull(),
  finalScore: integer("final_score"),
  finalRank: integer("final_rank"),

  // 接力段落指派
  relaySegment: integer("relay_segment"),
  relayStatus: varchar("relay_status", { length: 20 }).default("pending"), // pending, active, completed

  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (table) => [
  index("idx_match_participants_match_id").on(table.matchId),
  index("idx_match_participants_user_id").on(table.userId),
  index("idx_match_participants_team_id").on(table.teamId),
]);

// ============================================================================
// Zod Schema
// ============================================================================
export const matchSettingsSchema = z.object({
  timeLimit: z.number().int().positive().optional(),
  scoringMode: z.enum(scoringModeEnum).default("combined"),
  showRealTimeRanking: z.boolean().default(true),
  maxParticipants: z.number().int().positive().optional(),
  countdownSeconds: z.number().int().min(0).max(30).optional(),
});

export const relayConfigSchema = z.object({
  segmentCount: z.number().int().positive(),
  handoffMethod: z.enum(handoffMethodEnum).default("auto_on_complete"),
  segmentTimeLimit: z.number().int().positive().optional(),
  allowBacktrack: z.boolean().default(false),
});

export const insertGameMatchSchema = createInsertSchema(gameMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMatchParticipantSchema = createInsertSchema(matchParticipants).omit({
  id: true,
  joinedAt: true,
});

// ============================================================================
// Type exports
// ============================================================================
export type GameMatch = typeof gameMatches.$inferSelect;
export type InsertGameMatch = typeof gameMatches.$inferInsert;
export type MatchParticipant = typeof matchParticipants.$inferSelect;
export type InsertMatchParticipant = typeof matchParticipants.$inferInsert;
