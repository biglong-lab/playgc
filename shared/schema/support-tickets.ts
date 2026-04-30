// 🎫 客服工單系統（P0-2）
//
// 涵蓋場景：
//   1. 場域申請 — 跨場域申請 → 工單追蹤審核流程
//   2. 玩家檢舉 — 玩家舉報遊戲/場域 → 工單分派處理
//   3. 一般客服 — 場域 admin 詢問問題 → 工單回應
//
// 設計原則：
//   - 一個工單可有多輪內部留言（messages 表）
//   - 支援 priority / category / status 三維分類
//   - 可關聯到 fieldId / applicationId / userId（誰提的）
//   - audit_logs 記錄所有狀態變更
import { pgTable, varchar, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { fields } from "./fields";
import { adminAccounts } from "./roles";

// ============================================================================
// 工單類型 / 優先度 / 狀態
// ============================================================================
export const ticketCategoryEnum = [
  "field_application", // 場域申請審核
  "player_report",     // 玩家檢舉
  "support",           // 一般客服詢問
  "billing",           // 計費問題
  "bug_report",        // 系統錯誤回報
  "feature_request",   // 功能需求
] as const;
export type TicketCategory = (typeof ticketCategoryEnum)[number];

export const ticketPriorityEnum = ["low", "normal", "high", "urgent"] as const;
export type TicketPriority = (typeof ticketPriorityEnum)[number];

export const ticketStatusEnum = [
  "open",         // 新建未處理
  "in_progress",  // 處理中
  "waiting",      // 等待對方回應
  "resolved",     // 已解決
  "closed",       // 已關閉（不會再開）
] as const;
export type TicketStatus = (typeof ticketStatusEnum)[number];

// ============================================================================
// support_tickets — 工單主表
// ============================================================================
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

    // 基本資訊
    category: varchar("category", { length: 30 }).notNull(), // ticketCategoryEnum
    priority: varchar("priority", { length: 20 }).notNull().default("normal"),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),

    // 提交方（外部聯絡資訊，因申請方可能還沒帳號）
    submitterName: varchar("submitter_name", { length: 100 }),
    submitterEmail: varchar("submitter_email", { length: 200 }),
    submitterPhone: varchar("submitter_phone", { length: 50 }),
    submitterUserId: varchar("submitter_user_id"), // 若是已登入玩家

    // 關聯資源（依工單類型決定哪些有值）
    fieldId: varchar("field_id").references(() => fields.id, { onDelete: "set null" }),
    applicationId: varchar("application_id"), // 場域申請類型 → 對應 field_applications.id
    relatedTargetType: varchar("related_target_type", { length: 50 }), // game / session / device 等
    relatedTargetId: varchar("related_target_id"),

    // 分派
    assignedAdminId: varchar("assigned_admin_id").references(() => adminAccounts.id, { onDelete: "set null" }),

    // 完成資訊
    resolvedAt: timestamp("resolved_at"),
    resolvedByAdminId: varchar("resolved_by_admin_id").references(() => adminAccounts.id, { onDelete: "set null" }),
    resolutionNote: text("resolution_note"),

    // 自由 metadata（特定工單類型專用欄位）
    metadata: jsonb("metadata").default({}),

    // 來源追蹤
    submittedIp: varchar("submitted_ip", { length: 45 }),
    referrer: text("referrer"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_support_tickets_status").on(table.status),
    index("idx_support_tickets_category").on(table.category),
    index("idx_support_tickets_priority").on(table.priority),
    index("idx_support_tickets_field").on(table.fieldId),
    index("idx_support_tickets_assigned").on(table.assignedAdminId),
    index("idx_support_tickets_created").on(table.createdAt),
  ]
);

// ============================================================================
// support_ticket_messages — 工單留言（多輪對話）
// ============================================================================
export const supportTicketMessages = pgTable(
  "support_ticket_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    ticketId: varchar("ticket_id")
      .notNull()
      .references(() => supportTickets.id, { onDelete: "cascade" }),

    // 留言內容
    body: text("body").notNull(),

    // 留言者（admin 或 submitter）
    authorAdminId: varchar("author_admin_id").references(() => adminAccounts.id, { onDelete: "set null" }),
    authorIsSubmitter: text("author_is_submitter"), // "yes" / "no" / null（系統訊息）
    authorName: varchar("author_name", { length: 100 }), // 顯示用名稱

    // 是否內部留言（不對 submitter 顯示）
    internal: text("internal").default("no"), // "yes" / "no"

    metadata: jsonb("metadata").default({}),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_ticket_messages_ticket").on(table.ticketId),
    index("idx_ticket_messages_created").on(table.createdAt),
  ]
);

// ============================================================================
// Zod schemas
// ============================================================================
export const insertSupportTicketSchema = createInsertSchema(supportTickets).omit({
  id: true,
  resolvedAt: true,
  resolvedByAdminId: true,
  submittedIp: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSupportTicketMessageSchema = createInsertSchema(supportTicketMessages).omit({
  id: true,
  createdAt: true,
});

/** 公開建立工單（給場域 admin / 玩家用）*/
export const publicCreateTicketSchema = z.object({
  category: z.enum(ticketCategoryEnum),
  priority: z.enum(ticketPriorityEnum).optional().default("normal"),
  title: z.string().min(2, "標題至少 2 字").max(200),
  description: z.string().max(5000).optional(),
  submitterName: z.string().max(100).optional(),
  submitterEmail: z.string().email("email 格式錯誤").max(200).optional(),
  submitterPhone: z.string().max(50).optional(),
  fieldId: z.string().uuid().optional(),
  relatedTargetType: z.string().max(50).optional(),
  relatedTargetId: z.string().max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type SupportTicket = typeof supportTickets.$inferSelect;
export type SupportTicketMessage = typeof supportTicketMessages.$inferSelect;
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type PublicCreateTicket = z.infer<typeof publicCreateTicketSchema>;
