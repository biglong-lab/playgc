// 水彈對戰 PK 擂台 — 賽季系統 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { fields } from "./fields";
import { users } from "./users";

// ============================================================================
// 賽季狀態
// ============================================================================
export const seasonStatusEnum = ["active", "ended"] as const;
export type SeasonStatus = typeof seasonStatusEnum[number];

// ============================================================================
// 賽季獎勵介面
// ============================================================================
export interface SeasonReward {
  tier: string;
  minRank?: number;
  maxRank?: number;
  title?: string;
  description?: string;
}

// ============================================================================
// 賽季表
// ============================================================================
export const battleSeasons = pgTable("battle_seasons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").notNull().references(() => fields.id, { onDelete: "cascade" }),
  seasonNumber: integer("season_number").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  resetRatingTo: integer("reset_rating_to").notNull().default(1000),
  rewards: jsonb("rewards").$type<SeasonReward[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_season_field_number").on(table.fieldId, table.seasonNumber),
  index("idx_battle_season_field_status").on(table.fieldId, table.status),
]);

// ============================================================================
// 賽季排名快照表
// ============================================================================
export const battleSeasonRankings = pgTable("battle_season_rankings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  seasonId: varchar("season_id").notNull().references(() => battleSeasons.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  fieldId: varchar("field_id").notNull().references(() => fields.id),
  finalRating: integer("final_rating").notNull(),
  finalTier: varchar("final_tier", { length: 20 }).notNull(),
  totalBattles: integer("total_battles").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  losses: integer("losses").notNull().default(0),
  draws: integer("draws").notNull().default(0),
  rank: integer("rank").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_season_ranking").on(table.seasonId, table.userId),
  index("idx_battle_season_ranking_season").on(table.seasonId, table.rank),
]);

// ============================================================================
// Zod 驗證
// ============================================================================
export const createSeasonSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().or(z.date()),
  resetRatingTo: z.number().int().min(0).max(5000).default(1000),
  rewards: z.array(z.object({
    tier: z.string(),
    minRank: z.number().int().optional(),
    maxRank: z.number().int().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleSeason = typeof battleSeasons.$inferSelect;
export type InsertBattleSeason = typeof battleSeasons.$inferInsert;
export type BattleSeasonRanking = typeof battleSeasonRankings.$inferSelect;
export type InsertBattleSeasonRanking = typeof battleSeasonRankings.$inferInsert;
