// 場域申請 (Field Applications) - 公開場域開通申請流程
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
import { fields } from "./fields";

// ============================================================================
// Enums
// ============================================================================

export const applicationStatusEnum = [
  "pending",     // 待審核
  "contacted",   // 已聯絡（待補資料）
  "approved",    // 已通過，已開通場域
  "rejected",    // 已拒絕
] as const;
export type ApplicationStatus = (typeof applicationStatusEnum)[number];

export const businessTypeEnum = [
  "homestay",    // 民宿
  "camp",        // 營隊
  "tourism",     // 觀光地
  "school",      // 學校
  "enterprise",  // 企業
  "event",       // 活動公司
  "other",       // 其他
] as const;
export type BusinessType = (typeof businessTypeEnum)[number];

// ============================================================================
// Field Applications 表 - 場域申請記錄
// ============================================================================

export const fieldApplications = pgTable(
  "field_applications",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // 申請方基本資料
    businessName: varchar("business_name", { length: 200 }).notNull(),
    businessType: varchar("business_type", { length: 30 }).notNull(),
    contactName: varchar("contact_name", { length: 100 }).notNull(),
    contactEmail: varchar("contact_email", { length: 200 }).notNull(),
    contactPhone: varchar("contact_phone", { length: 50 }),

    // 場域資訊
    preferredFieldCode: varchar("preferred_field_code", { length: 50 }), // 希望的場域代碼
    address: text("address"),
    expectedPlayersPerMonth: integer("expected_players_per_month"),
    preferredPlan: varchar("preferred_plan", { length: 30 }), // 期望方案 'free' | 'pro' | 'enterprise'

    // 申請訊息
    message: text("message"),
    metadata: jsonb("metadata").default({}), // 其他附加資訊

    // 審核狀態
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    adminNotes: text("admin_notes"),
    reviewerId: varchar("reviewer_id"), // 審核者 admin_account_id
    reviewedAt: timestamp("reviewed_at"),
    rejectionReason: text("rejection_reason"),

    // 若通過，對應的場域
    createdFieldId: varchar("created_field_id").references(() => fields.id, { onDelete: "set null" }),

    // IP / 來源追蹤
    submittedIp: varchar("submitted_ip", { length: 45 }),
    referrer: text("referrer"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_field_applications_status").on(table.status),
    index("idx_field_applications_email").on(table.contactEmail),
    index("idx_field_applications_created").on(table.createdAt),
  ]
);

// ============================================================================
// Zod Schemas & Types
// ============================================================================

export const insertFieldApplicationSchema = createInsertSchema(fieldApplications).omit({
  id: true,
  status: true,
  adminNotes: true,
  reviewerId: true,
  reviewedAt: true,
  rejectionReason: true,
  createdFieldId: true,
  submittedIp: true,
  createdAt: true,
  updatedAt: true,
});

/** 公開申請表單驗證 */
export const publicApplicationSchema = z.object({
  businessName: z.string().min(2, "商業名稱至少 2 字").max(200),
  businessType: z.enum(businessTypeEnum),
  contactName: z.string().min(2, "聯絡人姓名至少 2 字").max(100),
  contactEmail: z.string().email("email 格式錯誤").max(200),
  contactPhone: z.string().max(50).optional(),
  preferredFieldCode: z
    .string()
    .regex(/^[A-Z0-9]{3,20}$/, "場域代碼 3-20 字元，僅限大寫英數")
    .optional(),
  address: z.string().max(500).optional(),
  expectedPlayersPerMonth: z.number().int().min(0).optional(),
  preferredPlan: z.enum(["free", "pro", "enterprise", "revshare"]).optional(),
  message: z.string().max(2000).optional(),
});

export type InsertFieldApplication = z.infer<typeof insertFieldApplicationSchema>;
export type PublicApplication = z.infer<typeof publicApplicationSchema>;
export type FieldApplication = typeof fieldApplications.$inferSelect;
