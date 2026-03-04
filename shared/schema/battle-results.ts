// 水彈對戰 PK 擂台 — 對戰結果 + 個人戰績 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { battleVenues } from "./battle-venues";
import { battleSlots } from "./battle-slots";
import { users } from "./users";
import { fields } from "./fields";

// ============================================================================
// Enums
// ============================================================================
export const tierEnum = [
  "bronze",    // 🥉 新兵 0-299
  "silver",    // 🥈 步兵 300-599
  "gold",      // 🥇 突擊 600-999
  "platinum",  // 💎 精英 1000-1499
  "diamond",   // 💠 菁英 1500-1999
  "master",    // 👑 傳奇 2000+
] as const;
export type Tier = typeof tierEnum[number];

/** 依分數計算段位 */
export function getTierFromRating(rating: number): Tier {
  if (rating >= 2000) return "master";
  if (rating >= 1500) return "diamond";
  if (rating >= 1000) return "platinum";
  if (rating >= 600) return "gold";
  if (rating >= 300) return "silver";
  return "bronze";
}

/** 段位中文名稱 */
export const tierLabels: Record<Tier, string> = {
  bronze: "🥉 新兵",
  silver: "🥈 步兵",
  gold: "🥇 突擊",
  platinum: "💎 精英",
  diamond: "💠 菁英",
  master: "👑 傳奇",
};

// ============================================================================
// 隊伍分數型別
// ============================================================================
export interface TeamScore {
  teamName: string;
  score: number;
}

export interface BattleHighlight {
  type: string;       // "most_eliminations" | "mvp" | "first_blood"
  userId: string;
  value?: number;
  description?: string;
}

// ============================================================================
// 對戰結果表
// ============================================================================
export const battleResults = pgTable("battle_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").notNull().references(() => battleSlots.id, { onDelete: "cascade" }),
  venueId: varchar("venue_id").notNull().references(() => battleVenues.id),
  winningTeam: varchar("winning_team", { length: 50 }),
  isDraw: boolean("is_draw").notNull().default(false),
  teamScores: jsonb("team_scores").$type<TeamScore[]>().default([]),
  durationMinutes: integer("duration_minutes"),
  mvpUserId: varchar("mvp_user_id").references(() => users.id),
  highlights: jsonb("highlights").$type<BattleHighlight[]>().default([]),
  photos: jsonb("photos").$type<string[]>().default([]),
  notes: text("notes"),
  recordedBy: varchar("recorded_by"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_result_slot").on(table.slotId),
  index("idx_battle_result_venue").on(table.venueId),
]);

// ============================================================================
// 個人戰績表
// ============================================================================
export const battlePlayerResults = pgTable("battle_player_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  resultId: varchar("result_id").notNull().references(() => battleResults.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  team: varchar("team", { length: 50 }).notNull(),
  score: integer("score").notNull().default(0),
  hits: integer("hits").notNull().default(0),
  eliminations: integer("eliminations").notNull().default(0),
  deaths: integer("deaths").notNull().default(0),
  isMvp: boolean("is_mvp").notNull().default(false),
  ratingBefore: integer("rating_before").notNull().default(1000),
  ratingAfter: integer("rating_after").notNull().default(1000),
  ratingChange: integer("rating_change").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_player_result").on(table.resultId, table.userId),
  index("idx_battle_player_result_user").on(table.userId),
]);

// ============================================================================
// 玩家排名表
// ============================================================================
export const battlePlayerRankings = pgTable("battle_player_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fieldId: varchar("field_id").notNull().references(() => fields.id),
  rating: integer("rating").notNull().default(1000),
  tier: varchar("tier", { length: 20 }).notNull().default("platinum"),
  totalBattles: integer("total_battles").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  winStreak: integer("win_streak").notNull().default(0),
  bestStreak: integer("best_streak").notNull().default(0),
  mvpCount: integer("mvp_count").notNull().default(0),
  season: integer("season").notNull().default(1),
  seasonRating: integer("season_rating").notNull().default(1000),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_ranking_user_field").on(table.userId, table.fieldId),
  index("idx_battle_ranking_field_rating").on(table.fieldId, table.rating),
  index("idx_battle_ranking_tier").on(table.tier),
]);

// ============================================================================
// Zod 驗證
// ============================================================================

/** 管理員記錄對戰結果 */
export const insertBattleResultSchema = z.object({
  winningTeam: z.string().max(50).optional(),
  isDraw: z.boolean().default(false),
  teamScores: z.array(z.object({
    teamName: z.string(),
    score: z.number().int().min(0),
  })).optional(),
  durationMinutes: z.number().int().min(1).optional(),
  mvpUserId: z.string().optional(),
  highlights: z.array(z.object({
    type: z.string(),
    userId: z.string(),
    value: z.number().optional(),
    description: z.string().optional(),
  })).optional(),
  photos: z.array(z.string()).optional(),
  notes: z.string().max(1000).optional(),
});

/** 個人戰績輸入 */
export const insertPlayerResultSchema = z.object({
  userId: z.string(),
  team: z.string(),
  score: z.number().int().min(0).default(0),
  hits: z.number().int().min(0).default(0),
  eliminations: z.number().int().min(0).default(0),
  deaths: z.number().int().min(0).default(0),
  isMvp: z.boolean().default(false),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleResult = typeof battleResults.$inferSelect;
export type InsertBattleResult = typeof battleResults.$inferInsert;
export type BattlePlayerResult = typeof battlePlayerResults.$inferSelect;
export type InsertBattlePlayerResult = typeof battlePlayerResults.$inferInsert;
export type BattlePlayerRanking = typeof battlePlayerRankings.$inferSelect;
export type InsertBattlePlayerRanking = typeof battlePlayerRankings.$inferInsert;
