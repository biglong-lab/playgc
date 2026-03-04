// 水彈對戰 PK 擂台 — 成就系統 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { fields } from "./fields";
import { users } from "./users";
import { battleResults } from "./battle-results";

// ============================================================================
// 成就稀有度
// ============================================================================
export const achievementRarityEnum = [
  "common",     // 普通
  "uncommon",   // 不常見
  "rare",       // 稀有
  "epic",       // 史詩
  "legendary",  // 傳說
] as const;
export type AchievementRarity = typeof achievementRarityEnum[number];

export const rarityLabels: Record<AchievementRarity, string> = {
  common: "普通",
  uncommon: "不常見",
  rare: "稀有",
  epic: "史詩",
  legendary: "傳說",
};

export const rarityColors: Record<AchievementRarity, string> = {
  common: "#9CA3AF",
  uncommon: "#22C55E",
  rare: "#3B82F6",
  epic: "#A855F7",
  legendary: "#F59E0B",
};

// ============================================================================
// 成就分類
// ============================================================================
export const achievementCategoryEnum = [
  "milestone",  // 里程碑（場次/勝場相關）
  "combat",     // 戰鬥（MVP/段位相關）
  "streak",     // 連勝系列
  "social",     // 社交（戰隊/組隊相關）
] as const;
export type AchievementCategory = typeof achievementCategoryEnum[number];

export const categoryLabels: Record<AchievementCategory, string> = {
  milestone: "里程碑",
  combat: "戰鬥",
  streak: "連勝",
  social: "社交",
};

// ============================================================================
// 成就條件介面
// ============================================================================
export interface AchievementCondition {
  type: "wins" | "streak" | "mvp_count" | "total_battles" | "tier_reached" | "first_win" | "clan_battle";
  threshold?: number;
  comparison?: "gte" | "eq";
  /** tier_reached 用 */
  tier?: string;
}

// ============================================================================
// 成就定義表
// ============================================================================
export const battleAchievementDefs = pgTable("battle_achievement_defs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").references(() => fields.id, { onDelete: "cascade" }),
  key: varchar("key", { length: 50 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  iconUrl: varchar("icon_url", { length: 500 }),
  category: varchar("category", { length: 20 }).notNull().default("milestone"),
  rarity: varchar("rarity", { length: 20 }).notNull().default("common"),
  condition: jsonb("condition").$type<AchievementCondition>().notNull(),
  points: integer("points").notNull().default(10),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================================
// 玩家成就表
// ============================================================================
export const battlePlayerAchievements = pgTable("battle_player_achievements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  achievementId: varchar("achievement_id").notNull().references(() => battleAchievementDefs.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
  resultId: varchar("result_id").references(() => battleResults.id),
}, (table) => [
  unique("uq_battle_player_achievement").on(table.achievementId, table.userId),
  index("idx_battle_player_achievement_user").on(table.userId),
]);

// ============================================================================
// Zod 驗證
// ============================================================================
export const achievementConditionSchema = z.object({
  type: z.enum(["wins", "streak", "mvp_count", "total_battles", "tier_reached", "first_win", "clan_battle"]),
  threshold: z.number().int().optional(),
  comparison: z.enum(["gte", "eq"]).optional(),
  tier: z.string().optional(),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleAchievementDef = typeof battleAchievementDefs.$inferSelect;
export type InsertBattleAchievementDef = typeof battleAchievementDefs.$inferInsert;
export type BattlePlayerAchievement = typeof battlePlayerAchievements.$inferSelect;
export type InsertBattlePlayerAchievement = typeof battlePlayerAchievements.$inferInsert;
