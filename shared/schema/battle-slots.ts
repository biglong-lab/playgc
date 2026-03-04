// 水彈對戰 PK 擂台 — 時段、報名、預組小隊 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  date,
  time,
  jsonb,
  index,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { battleVenues } from "./battle-venues";
import { users } from "./users";

// ============================================================================
// Enums
// ============================================================================
export const slotTypeEnum = ["open", "private", "tournament"] as const;
export type SlotType = typeof slotTypeEnum[number];

export const slotStatusEnum = [
  "open",         // 開放報名
  "confirmed",    // 已成局（達最低人數）
  "full",         // 已滿員
  "in_progress",  // 對戰進行中
  "completed",    // 已完成
  "cancelled",    // 已取消
] as const;
export type SlotStatus = typeof slotStatusEnum[number];

export const registrationTypeEnum = [
  "individual",      // 個人散客
  "premade_leader",  // 預組隊伍隊長
  "premade_member",  // 預組隊伍成員
] as const;
export type RegistrationType = typeof registrationTypeEnum[number];

export const registrationStatusEnum = [
  "registered",  // 已報名
  "confirmed",   // 已確認出席
  "checked_in",  // 已報到
  "no_show",     // 未到場
  "cancelled",   // 已取消
] as const;
export type RegistrationStatus = typeof registrationStatusEnum[number];

export const skillLevelEnum = ["beginner", "intermediate", "advanced"] as const;
export type SkillLevel = typeof skillLevelEnum[number];

// ============================================================================
// 對戰時段表
// ============================================================================
export const battleSlots = pgTable("battle_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  venueId: varchar("venue_id").notNull().references(() => battleVenues.id, { onDelete: "cascade" }),
  slotDate: date("slot_date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  slotType: varchar("slot_type", { length: 20 }).notNull().default("open"),
  status: varchar("status", { length: 20 }).notNull().default("open"),

  // 人數覆寫（null 表示使用場地預設）
  minPlayersOverride: integer("min_players_override"),
  maxPlayersOverride: integer("max_players_override"),

  // 即時計數
  currentCount: integer("current_count").notNull().default(0),
  confirmedCount: integer("confirmed_count").notNull().default(0),

  // 費用覆寫
  pricePerPerson: integer("price_per_person"),

  // 時間控制
  registrationDeadline: timestamp("registration_deadline"),
  confirmationDeadline: timestamp("confirmation_deadline"),

  notes: text("notes"),
  repeatRule: jsonb("repeat_rule"),

  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_battle_slots_venue_date").on(table.venueId, table.slotDate),
  index("idx_battle_slots_status").on(table.status),
]);

// ============================================================================
// 報名記錄表
// ============================================================================
export const battleRegistrations = pgTable("battle_registrations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").notNull().references(() => battleSlots.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id),
  premadeGroupId: varchar("premade_group_id"),

  registrationType: varchar("registration_type", { length: 20 }).notNull().default("individual"),
  status: varchar("status", { length: 20 }).notNull().default("registered"),

  assignedTeam: varchar("assigned_team", { length: 50 }),
  equipmentSelection: jsonb("equipment_selection").default([]),
  depositPaid: boolean("deposit_paid").notNull().default(false),
  depositTransactionId: varchar("deposit_transaction_id"),
  skillLevel: varchar("skill_level", { length: 20 }).default("beginner"),
  notes: text("notes"),

  registeredAt: timestamp("registered_at").defaultNow().notNull(),
  confirmedAt: timestamp("confirmed_at"),
  checkedInAt: timestamp("checked_in_at"),
  cancelledAt: timestamp("cancelled_at"),
}, (table) => [
  unique("uq_battle_reg_slot_user").on(table.slotId, table.userId),
  index("idx_battle_reg_slot").on(table.slotId),
  index("idx_battle_reg_user").on(table.userId),
  index("idx_battle_reg_premade").on(table.premadeGroupId),
]);

// ============================================================================
// 預組小隊表
// ============================================================================
export const battlePremadeGroups = pgTable("battle_premade_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slotId: varchar("slot_id").notNull().references(() => battleSlots.id, { onDelete: "cascade" }),
  leaderId: varchar("leader_id").notNull().references(() => users.id),
  name: varchar("name", { length: 100 }),
  accessCode: varchar("access_code", { length: 10 }).notNull(),
  memberCount: integer("member_count").notNull().default(1),
  keepTogether: boolean("keep_together").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("uq_premade_access_code").on(table.accessCode),
  index("idx_premade_slot").on(table.slotId),
]);

// ============================================================================
// Zod 驗證
// ============================================================================
export const insertBattleSlotSchema = createInsertSchema(battleSlots).omit({
  id: true,
  currentCount: true,
  confirmedCount: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  slotType: z.enum(slotTypeEnum).default("open"),
  status: z.enum(slotStatusEnum).default("open"),
  slotDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式：YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式：HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "時間格式：HH:MM"),
});

export const insertRegistrationSchema = z.object({
  skillLevel: z.enum(skillLevelEnum).default("beginner"),
  equipmentSelection: z.array(z.string()).optional(),
  notes: z.string().max(500).optional(),
});

export const insertPremadeGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  keepTogether: z.boolean().default(true),
});

// ============================================================================
// Type exports
// ============================================================================
export type BattleSlot = typeof battleSlots.$inferSelect;
export type InsertBattleSlot = typeof battleSlots.$inferInsert;
export type BattleRegistration = typeof battleRegistrations.$inferSelect;
export type InsertBattleRegistration = typeof battleRegistrations.$inferInsert;
export type BattlePremadeGroup = typeof battlePremadeGroups.$inferSelect;
export type InsertBattlePremadeGroup = typeof battlePremadeGroups.$inferInsert;
