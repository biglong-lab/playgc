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

// =============== Session Reports（活動結束自動報告 / Phase 3）===============
//
// 每場 multi session 結束時自動產生一份報告：
//   - 撈 ws_event_log 統計（reconnect / grace / auto_leave / 平均延遲）
//   - 撈業務數據（完成率、合照率、答對率）
//   - 跟前 5 場對比、算 anomaly score
//   - Telegram 推給業主、admin UI 看歷史
//
export const sessionReports = pgTable(
  "session_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    gameId: varchar("game_id", { length: 100 }),
    fieldId: varchar("field_id", { length: 100 }),

    // 時段
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    durationMs: integer("duration_ms"),

    // 玩家統計
    totalPlayers: integer("total_players").default(0),
    completedPlayers: integer("completed_players").default(0),

    // WS 健康度
    wsConnects: integer("ws_connects").default(0),
    wsCloses: integer("ws_closes").default(0),
    wsConfigChangeCloses: integer("ws_config_change_closes").default(0),
    wsAbnormalCloses: integer("ws_abnormal_closes").default(0),
    graceStartCount: integer("grace_start_count").default(0),
    graceExpiredCount: integer("grace_expired_count").default(0),
    autoLeaveCount: integer("auto_leave_count").default(0),
    avgWsLatencyMs: integer("avg_ws_latency_ms"),

    // 業務指標
    completionRate: integer("completion_rate"), // 0-100 整數百分比
    triviaAnswerCount: integer("trivia_answer_count").default(0),
    triviaCorrectRate: integer("trivia_correct_rate"), // 0-100
    photoTeamCompletedCount: integer("photo_team_completed_count").default(0),

    // 異常分析
    anomalyScore: integer("anomaly_score").default(0), // 0-100、越高越異常
    anomalies: jsonb("anomalies"), // 異常清單 [{type, severity, message}]

    // 跟前 5 場對比基準
    baselineSnapshot: jsonb("baseline_snapshot"), // 前 5 場平均值

    // 通知狀態
    telegramSent: boolean("telegram_sent").default(false),
    telegramSentAt: timestamp("telegram_sent_at"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_session_reports_session").on(table.sessionId),
    index("idx_session_reports_created").on(table.createdAt),
    index("idx_session_reports_anomaly").on(table.anomalyScore, table.createdAt),
  ],
);

export const insertSessionReportSchema = createInsertSchema(sessionReports).omit({
  id: true,
  createdAt: true,
});
export type SessionReport = typeof sessionReports.$inferSelect;
export type InsertSessionReport = z.infer<typeof insertSessionReportSchema>;

export interface SessionReportAnomaly {
  type: "ws_grace_high" | "ws_auto_leave_high" | "ws_config_change_high" | "completion_low" | "latency_high" | "abnormal_close_high";
  severity: "low" | "medium" | "high";
  message: string;
  /** 當前值 */
  value: number;
  /** 基準值（前 5 場平均）*/
  baseline?: number;
  /** 警戒閾值 */
  threshold: number;
}

// =============== Component Runs（元件健康度紀錄 / Phase 1 / 2026-05-12）===============
//
// 每個元件 mount → 完成 / 失敗 全紀錄、用於：
//   - 業主問「水彈元件 7 天表現？」→ 立即量化
//   - 找出失敗率高的元件（建議重構優先級）
//   - 平均互動延遲、Page-level loading perf
//
// finalState 列舉：
//   - completed：玩家正常完成
//   - abandoned：玩家離開頁面未完成（unmount without complete）
//   - errored：元件 throw error（ErrorBoundary 收）
//   - timeout：超過 X 分鐘未完成（cron 後處理）
//   - skipped：玩家主動跳過
//
export const componentRuns = pgTable(
  "component_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id", { length: 100 }),
    userId: varchar("user_id", { length: 100 }),
    teamId: varchar("team_id", { length: 100 }),
    pageId: varchar("page_id", { length: 100 }),
    componentType: varchar("component_type", { length: 50 }).notNull(),

    // 時間點
    mountedAt: timestamp("mounted_at").defaultNow().notNull(),
    firstInteractionAt: timestamp("first_interaction_at"),
    completedAt: timestamp("completed_at"),

    // 結算
    finalState: varchar("final_state", { length: 20 }), // null = in_progress
    durationMs: integer("duration_ms"),
    interactionLatencyMs: integer("interaction_latency_ms"),

    // 計數
    retryCount: integer("retry_count").default(0),
    errorCount: integer("error_count").default(0),
    networkErrorCount: integer("network_error_count").default(0),

    // 最後錯誤
    lastError: text("last_error"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_component_runs_session").on(table.sessionId, table.mountedAt),
    index("idx_component_runs_type_time").on(table.componentType, table.mountedAt),
    index("idx_component_runs_user_time").on(table.userId, table.mountedAt),
    index("idx_component_runs_state").on(table.finalState, table.mountedAt),
    index("idx_component_runs_cleanup").on(table.mountedAt), // 90 天 retention
  ],
);

export const insertComponentRunSchema = createInsertSchema(componentRuns).omit({
  id: true,
  createdAt: true,
});
export type ComponentRun = typeof componentRuns.$inferSelect;
export type InsertComponentRun = z.infer<typeof insertComponentRunSchema>;

export type ComponentFinalState = "completed" | "abandoned" | "errored" | "timeout" | "skipped";

// =============== Feature Flags（元件遠端開關 / Phase 4 / 2026-05-12）===============
//
// admin 可遠端關閉某元件（不用 deploy）
// 自動降級：cron 偵測失敗率 > 50% → 自動標 disabled
//
// disabledReason 列舉：
//   - "manual" — admin 手動關
//   - "auto:high_failure" — 自動降級（失敗率高）
//   - "auto:low_completion" — 自動降級（完成率低）
//
export const featureFlags = pgTable(
  "feature_flags",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** scope = 'global' 或 'field' */
    scope: varchar("scope", { length: 20 }).notNull().default("global"),
    fieldId: varchar("field_id", { length: 100 }), // null = global
    /** componentType（同 component_runs.componentType）或其他 module key */
    moduleKey: varchar("module_key", { length: 100 }).notNull(),
    enabled: boolean("enabled").notNull().default(true),
    disabledReason: varchar("disabled_reason", { length: 50 }),
    disabledAt: timestamp("disabled_at"),
    disabledBy: varchar("disabled_by", { length: 100 }), // admin user id 或 'system'
    /** 統計 snapshot（自動降級時記錄當時失敗率等）*/
    metrics: jsonb("metrics"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_feature_flags_lookup").on(table.scope, table.fieldId, table.moduleKey),
    index("idx_feature_flags_module").on(table.moduleKey),
  ],
);

export const insertFeatureFlagSchema = createInsertSchema(featureFlags).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type FeatureFlag = typeof featureFlags.$inferSelect;
export type InsertFeatureFlag = z.infer<typeof insertFeatureFlagSchema>;

// =============== Synthetic Runs（合成監測 / Phase 5 / 2026-05-12）===============
//
// 24/7 自動巡檢、每小時 cron 跑：
//   - 內部 fetch critical endpoints（health / version / cron health）
//   - 各 endpoint 回應時間 + status code
//   - 失敗推 Telegram + 寫紀錄
//
export const syntheticRuns = pgTable(
  "synthetic_runs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    runAt: timestamp("run_at").defaultNow().notNull(),
    totalChecks: integer("total_checks").default(0),
    passed: integer("passed").default(0),
    failed: integer("failed").default(0),
    avgResponseMs: integer("avg_response_ms"),
    /** 各 check 詳情（{ name, ok, status, responseMs, error? }[]）*/
    results: jsonb("results"),
    /** 是否觸發告警 */
    alertSent: boolean("alert_sent").default(false),
  },
  (table) => [
    index("idx_synthetic_runs_time").on(table.runAt),
    index("idx_synthetic_runs_failed").on(table.failed, table.runAt),
  ],
);

export type SyntheticRun = typeof syntheticRuns.$inferSelect;

export interface SyntheticCheckResult {
  name: string;
  url: string;
  method: string;
  ok: boolean;
  status: number;
  responseMs: number;
  error?: string;
}
