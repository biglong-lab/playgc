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
    source: varchar("source", { length: 100 }), // window-error / unhandled-rejection / boundary / server-middleware
    url: varchar("url", { length: 1000 }), // 觸發頁面 URL（client）/ request method+path（server）
    userAgent: varchar("user_agent", { length: 500 }),

    // 🆕 platform：區分 client / server 錯誤（2026-05-03 加）
    // - "client" = 瀏覽器拋出（useErrorReport 上報）
    // - "server" = server 全域 middleware / route catch
    platform: varchar("platform", { length: 20 }).default("client"),

    // 🆕 request 追蹤（2026-05-03 加、配合 X-Request-Id middleware）
    requestId: varchar("request_id", { length: 100 }),

    // 關聯
    userId: varchar("user_id"), // Firebase user（若已登入）
    fieldId: varchar("field_id"), // 場域（若 URL 在場域內）
    // 🆕 業務脈絡關聯（排錯時可關到使用者操作流程）
    sessionId: varchar("session_id"), // game_sessions（若 URL 含 sessionId）
    teamId: varchar("team_id"),       // teams（若操作關到隊伍）
    matchId: varchar("match_id"),     // game_matches（若對戰中）

    // server 端特有：HTTP status / route
    statusCode: integer("status_code"), // 5xx / 4xx
    method: varchar("method", { length: 10 }),
    route: varchar("route", { length: 200 }),

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
    // 🆕 platform / requestId / 業務關聯查詢索引
    index("idx_error_logs_platform_created").on(table.platform, table.createdAt),
    index("idx_error_logs_session").on(table.sessionId),
    index("idx_error_logs_team").on(table.teamId),
    index("idx_error_logs_user").on(table.userId),
  ]
);

export type ErrorLog = typeof errorLogs.$inferSelect;
