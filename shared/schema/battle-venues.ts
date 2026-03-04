// 水彈對戰 PK 擂台 — 場地 Schema
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";

// ============================================================================
// 場地類型
// ============================================================================
export const venueTypeEnum = [
  "water_gun",   // 水彈
  "paintball",   // 漆彈
  "laser",       // 雷射
  "nerf",        // Nerf
  "airsoft",     // 生存遊戲
] as const;
export type VenueType = typeof venueTypeEnum[number];

// ============================================================================
// 場地設定介面（存於 settings JSONB）
// ============================================================================
export interface BattleVenueSettings {
  readonly requireDeposit?: boolean;
  readonly depositAmount?: number;
  readonly pricePerPerson?: number;
  readonly cancelDeadlineHours?: number;
  readonly confirmDeadlineHours?: number;
  readonly checkInMinutesBefore?: number;
  readonly autoMatchEnabled?: boolean;
  readonly skillMatchEnabled?: boolean;
  readonly allowPremadeTeams?: boolean;
  readonly notifyHoursBefore?: readonly number[];
  readonly autoCloseHoursBefore?: number;
  readonly equipmentOptions?: readonly EquipmentOption[];
  readonly rules?: string;
}

export interface EquipmentOption {
  readonly name: string;
  readonly price: number;
  readonly included?: boolean;
}

// ============================================================================
// 對戰場地表
// ============================================================================
export const battleVenues = pgTable("battle_venues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldId: varchar("field_id").notNull().references(() => fields.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  coverImage: text("cover_image"),
  venueType: varchar("venue_type", { length: 20 }).notNull().default("water_gun"),
  minPlayers: integer("min_players").notNull().default(8),
  maxPlayers: integer("max_players").notNull().default(20),
  teamSize: integer("team_size").notNull().default(5),
  maxTeams: integer("max_teams").notNull().default(2),
  gameDurationMinutes: integer("game_duration_minutes").notNull().default(60),
  settings: jsonb("settings").$type<BattleVenueSettings>().default({}),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ============================================================================
// Zod 驗證
// ============================================================================
export const equipmentOptionSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().min(0),
  included: z.boolean().optional(),
});

export const battleVenueSettingsSchema = z.object({
  requireDeposit: z.boolean().optional(),
  depositAmount: z.number().min(0).optional(),
  pricePerPerson: z.number().min(0).optional(),
  cancelDeadlineHours: z.number().int().min(0).max(72).optional(),
  confirmDeadlineHours: z.number().int().min(0).max(48).optional(),
  checkInMinutesBefore: z.number().int().min(0).max(120).optional(),
  autoMatchEnabled: z.boolean().optional(),
  skillMatchEnabled: z.boolean().optional(),
  allowPremadeTeams: z.boolean().optional(),
  notifyHoursBefore: z.array(z.number().int().min(0).max(72)).optional(),
  autoCloseHoursBefore: z.number().int().min(0).max(48).optional(),
  equipmentOptions: z.array(equipmentOptionSchema).optional(),
  rules: z.string().max(5000).optional(),
});

export const insertBattleVenueSchema = createInsertSchema(battleVenues).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  venueType: z.enum(venueTypeEnum).default("water_gun"),
  settings: battleVenueSettingsSchema.optional(),
});

export const updateBattleVenueSchema = insertBattleVenueSchema.partial();

// ============================================================================
// Type exports
// ============================================================================
export type BattleVenue = typeof battleVenues.$inferSelect;
export type InsertBattleVenue = typeof battleVenues.$inferInsert;
