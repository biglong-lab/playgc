// 水彈對戰 PK 擂台 — 戰隊系統 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { fields } from "./fields";

// ============================================================================
// 戰隊角色
// ============================================================================
export const clanRoleEnum = ["leader", "officer", "member"] as const;
export type ClanRole = typeof clanRoleEnum[number];

export const clanRoleLabels: Record<ClanRole, string> = {
  leader: "隊長",
  officer: "幹部",
  member: "隊員",
};

// ============================================================================
// 戰隊表
// ============================================================================
export const battleClans = pgTable("battle_clans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").notNull().references(() => fields.id),
  name: varchar("name", { length: 50 }).notNull(),
  tag: varchar("tag", { length: 10 }).notNull(),
  logoUrl: text("logo_url"),
  leaderId: varchar("leader_id").notNull().references(() => users.id),
  description: text("description"),
  memberCount: integer("member_count").notNull().default(1),
  totalWins: integer("total_wins").notNull().default(0),
  totalLosses: integer("total_losses").notNull().default(0),
  totalDraws: integer("total_draws").notNull().default(0),
  clanRating: integer("clan_rating").notNull().default(1000),
  maxMembers: integer("max_members").notNull().default(20),
  isActive: boolean("is_active").notNull().default(true),
  /** 🆕 改名冷卻 — 詳見 docs/SQUAD_SYSTEM_DESIGN.md §17.3 */
  nameChangedAt: timestamp("name_changed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_battle_clan_field_name").on(table.fieldId, table.name),
  unique("uq_battle_clan_field_tag").on(table.fieldId, table.tag),
  index("idx_battle_clan_field").on(table.fieldId),
  index("idx_battle_clan_leader").on(table.leaderId),
]);

// ============================================================================
// 戰隊成員表
// ============================================================================
export const battleClanMembers = pgTable("battle_clan_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clanId: varchar("clan_id").notNull().references(() => battleClans.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  leftAt: timestamp("left_at"),
}, (table) => [
  unique("uq_battle_clan_member").on(table.clanId, table.userId),
  index("idx_battle_clan_member_user").on(table.userId),
  index("idx_battle_clan_member_clan").on(table.clanId),
]);

// ============================================================================
// Zod 驗證
// ============================================================================

/** 建立戰隊 */
export const insertBattleClanSchema = z.object({
  name: z.string().min(2).max(50),
  tag: z.string().min(1).max(10).regex(/^[A-Za-z0-9\u4e00-\u9fff]+$/, "標籤只能包含字母、數字、中文"),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  maxMembers: z.number().int().min(2).max(50).default(20),
});

/** 更新戰隊 */
export const updateBattleClanSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  tag: z.string().min(1).max(10).regex(/^[A-Za-z0-9\u4e00-\u9fff]+$/).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().nullable().optional(),
  maxMembers: z.number().int().min(2).max(50).optional(),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleClan = typeof battleClans.$inferSelect;
export type InsertBattleClan = typeof battleClans.$inferInsert;
export type BattleClanMember = typeof battleClanMembers.$inferSelect;
export type InsertBattleClanMember = typeof battleClanMembers.$inferInsert;
