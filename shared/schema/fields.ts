// 場域 (Fields) - 場域/場地管理
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ============================================================================
// Fields table - 場域/Venue management
// ============================================================================
export const fields = pgTable("fields", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 200 }).notNull(),
  code: varchar("code", { length: 50 }).unique().notNull(), // Unique field code for login
  description: text("description"),
  address: text("address"),
  contactEmail: varchar("contact_email"),
  contactPhone: varchar("contact_phone"),
  logoUrl: text("logo_url"),
  settings: jsonb("settings").default({}), // Field-specific settings
  status: varchar("status", { length: 20 }).default("active"), // active, inactive, suspended
  codeLastChangedAt: timestamp("code_last_changed_at"), // Track when code was last changed for 6-month lock
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ============================================================================
// FieldSettings — 場域設定介面（存於 fields.settings jsonb）
// ============================================================================

export interface FieldSettings {
  // AI 設定
  geminiApiKey?: string;              // AES-256-GCM 加密後的密文
  enableAI?: boolean;                 // AI 功能總開關

  // 配額
  maxGames?: number;                  // 最大遊戲數（0 或 undefined = 無限）
  maxConcurrentSessions?: number;     // 最大同時場次

  // 功能開關
  enablePayment?: boolean;            // 收費功能
  enableTeamMode?: boolean;           // 團隊模式
  enableCompetitiveMode?: boolean;    // 競賽/接力模式

  // 品牌
  primaryColor?: string;              // 主色調 hex
  welcomeMessage?: string;            // 歡迎訊息
}

/** 安全解析 jsonb 為 FieldSettings，無效資料回傳空物件 */
export function parseFieldSettings(raw: unknown): FieldSettings {
  if (!raw || typeof raw !== "object") return {};
  return raw as FieldSettings;
}

// Field schemas
export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fields.$inferSelect;
