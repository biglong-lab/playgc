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

// Field schemas
export const insertFieldSchema = createInsertSchema(fields).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertField = z.infer<typeof insertFieldSchema>;
export type Field = typeof fields.$inferSelect;
