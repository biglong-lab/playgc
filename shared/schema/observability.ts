// 🔭 Observability — WS 事件 + DB 寫入完整紀錄
//
// Phase 0.2（2026-05-08）— 對應 docs/changes/2026-05-08-multi-stability-refactor-plan.md §3.3
//
// 用途：
//   - debug 多人遊戲斷線根因（時間軸完整重建）
//   - 爭議仲裁依據（業主給家屬/客戶看時間戳）
//   - 重構前後對比（Phase 1+ 改架構後 ws 連線數變化驗證）
//   - 後續優化基準（用真實資料、不靠感覺）
//
// 隱私：
//   - 對講機訊息預設不存內容（只存 metadata）、admin opt-in 才開
//   - 敏感欄位 redact（password / token / firebase_token / 信用卡）
//   - LINE / Firebase token 一律不存
//
// Retention：90 天（user 決定、爭議仲裁長期需求）
//   - 每天 03:00 cleanup 90 天前資料
//   - 評估資料量上限後可改 PostgreSQL declarative partitioning by day
//
import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  jsonb,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============== WS event log ===============
//
// 每個 WebSocket 事件一筆紀錄、含 inbound（client→server）與 outbound（server→client）
//
// eventType 列舉：
//   - connect      — 新連線建立
//   - close        — 連線關閉（含 reason）
//   - message      — 訊息（inbound）
//   - broadcast    — server 廣播（outbound、可能 1 訊息對 N 接收者）
//   - error        — ws error event
//   - grace_start  — 寬限期開始（玩家斷線、30s 緩衝）
//   - grace_expired — 寬限期到期（玩家未重連）
//   - auto_leave   — auto-leave 觸發（DB leftAt 寫入）
//   - reconnect    — 同 user 重新連線
//   - kick         — server 主動踢出（如自願 leave）
//
// direction 列舉：
//   - inbound      — client → server
//   - outbound     — server → client
//   - system       — server 內部事件（grace_start / auto_leave 等）
//
export const wsEventLog = pgTable(
  "ws_event_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp").defaultNow().notNull(),

    // 識別
    sessionId: varchar("session_id", { length: 100 }),  // gameSession id（連線初期可能 null）
    teamId: varchar("team_id", { length: 100 }),
    userId: varchar("user_id", { length: 100 }),
    userName: varchar("user_name", { length: 200 }),

    // 事件類型
    eventType: varchar("event_type", { length: 30 }).notNull(),
    direction: varchar("direction", { length: 10 }),    // inbound / outbound / system
    messageType: varchar("message_type", { length: 50 }), // team_join / team_score_update / ...

    // payload（已 redact 敏感欄位、限制 < 10KB）
    payload: jsonb("payload"),

    // 連線 metadata
    clientIp: varchar("client_ip", { length: 50 }),
    userAgent: varchar("user_agent", { length: 500 }),
    closeCode: integer("close_code"),                  // ws close code
    reason: varchar("reason", { length: 200 }),        // close reason / error message / kick reason

    // 效能
    latencyMs: integer("latency_ms"),                  // ping/pong 往返（如可量）

    // 廣播範圍（broadcast event）
    recipientCount: integer("recipient_count"),         // 該次 broadcast 的接收者數量
  },
  (table) => [
    index("idx_ws_event_session_time").on(table.sessionId, table.timestamp),
    index("idx_ws_event_team_time").on(table.teamId, table.timestamp),
    index("idx_ws_event_user_time").on(table.userId, table.timestamp),
    index("idx_ws_event_type_time").on(table.eventType, table.timestamp),
    index("idx_ws_event_cleanup").on(table.timestamp), // 90 天 retention cleanup
  ],
);

export const insertWsEventLogSchema = createInsertSchema(wsEventLog).omit({
  id: true,
  timestamp: true,
});
export type WsEventLog = typeof wsEventLog.$inferSelect;
export type InsertWsEventLog = z.infer<typeof insertWsEventLogSchema>;

// =============== DB write log ===============
//
// 多人遊戲關鍵 DB 寫入紀錄（team_game_states / team_lock_states / team_shooting_hits 等）
// 含樂觀鎖衝突、版本號變化
//
// 用途：
//   - 證據級紀錄：玩家「我明明答對」→ 看 DB write log 看實際 score 寫入內容
//   - 樂觀鎖統計：衝突頻率、retry 成功率
//
export const dbWriteLog = pgTable(
  "db_write_log",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    timestamp: timestamp("timestamp").defaultNow().notNull(),

    // 表 & 操作
    tableName: varchar("table_name", { length: 100 }).notNull(),
    operation: varchar("operation", { length: 20 }).notNull(), // insert / update / delete

    // 識別
    primaryKey: varchar("primary_key", { length: 200 }),       // composite key 用 JSON string
    sessionId: varchar("session_id", { length: 100 }),
    teamId: varchar("team_id", { length: 100 }),
    userId: varchar("user_id", { length: 100 }),

    // 資料
    before: jsonb("before"),                                   // 寫入前狀態（update / delete）
    after: jsonb("after"),                                     // 寫入後狀態（insert / update）

    // 衝突
    conflictType: varchar("conflict_type", { length: 50 }),    // optimistic_lock_409 / unique_violation / etc
    retrySucceeded: boolean("retry_succeeded"),

    // 觸發來源
    triggeredBy: varchar("triggered_by", { length: 50 }),      // ws_message / rest_api / cron / system
  },
  (table) => [
    index("idx_db_write_session_time").on(table.sessionId, table.timestamp),
    index("idx_db_write_team_time").on(table.teamId, table.timestamp),
    index("idx_db_write_table_time").on(table.tableName, table.timestamp),
    index("idx_db_write_conflict_time").on(table.conflictType, table.timestamp),
    index("idx_db_write_cleanup").on(table.timestamp), // 90 天 retention cleanup
  ],
);

export const insertDbWriteLogSchema = createInsertSchema(dbWriteLog).omit({
  id: true,
  timestamp: true,
});
export type DbWriteLog = typeof dbWriteLog.$inferSelect;
export type InsertDbWriteLog = z.infer<typeof insertDbWriteLogSchema>;

// =============== 隱私規範 ===============
//
// 預設不存的訊息類型：
//   - chat / team_chat：對講機訊息內容（只存 metadata：userId / length / messageType）
//
// 預設 redact 的欄位：
//   - password / passwd
//   - *_token / *Token（含 firebaseToken / hostToken / accessToken）
//   - *_secret / *Secret
//   - *_key / *Key（API key）
//   - creditCard / cardNumber
//
// admin opt-in 開關：env `ENABLE_CHAT_FULL_LOG=true` 才存對講機完整內容
//
export const REDACT_PATTERNS = [
  /password/i,
  /passwd/i,
  /token$/i,
  /secret/i,
  /api_?key/i,
  /credit_?card/i,
  /card_?number/i,
] as const;

export const SENSITIVE_MESSAGE_TYPES = [
  "chat",
  "team_chat",
] as const;

export type ObservabilityEventType =
  | "connect"
  | "close"
  | "message"
  | "broadcast"
  | "error"
  | "grace_start"
  | "grace_expired"
  | "auto_leave"
  | "reconnect"
  | "kick";

export type ObservabilityDirection = "inbound" | "outbound" | "system";
