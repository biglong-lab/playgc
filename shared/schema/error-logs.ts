// 🐛 系統錯誤日誌 schema
//
// 收集前端 ErrorBoundary / unhandledrejection 上報的錯誤
// platform admin 可查看、分類、標記已解決
import { pgTable, varchar, text, timestamp, index, integer } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const errorLogLevelEnum = ["error", "warning", "info"] as const;
export type ErrorLogLevel = (typeof errorLogLevelEnum)[number];

export const errorLogs = pgTable(
  "error_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    level: varchar("level", { length: 20 }).notNull().default("error"),

    message: text("message").notNull(),
    stack: text("stack"), // 堆疊（可選）
    source: varchar("source", { length: 100 }), // window-error / unhandled-rejection / boundary
    url: varchar("url", { length: 1000 }), // 觸發頁面 URL
    userAgent: varchar("user_agent", { length: 500 }),

    // 關聯
    userId: varchar("user_id"), // Firebase user（若已登入）
    fieldId: varchar("field_id"), // 場域（若 URL 在場域內）

    // 來源
    ipAddress: varchar("ip_address", { length: 45 }),

    // 統計（同類錯誤聚合）
    fingerprint: varchar("fingerprint", { length: 64 }), // hash(message + source + url)
    occurrenceCount: integer("occurrence_count").default(1),
    firstSeenAt: timestamp("first_seen_at").defaultNow(),
    lastSeenAt: timestamp("last_seen_at").defaultNow(),

    // 處理狀態
    resolvedAt: timestamp("resolved_at"),
    resolvedByAdminId: varchar("resolved_by_admin_id"),
    resolvedNote: text("resolved_note"),

    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_error_logs_level_created").on(table.level, table.createdAt),
    index("idx_error_logs_fingerprint").on(table.fingerprint),
    index("idx_error_logs_resolved").on(table.resolvedAt),
    index("idx_error_logs_field").on(table.fieldId),
  ]
);

export type ErrorLog = typeof errorLogs.$inferSelect;
