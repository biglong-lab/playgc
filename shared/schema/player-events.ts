// 📜 玩家行為事件流水帳
//
// 用途：紀錄玩家在遊戲中的每個動作，作為演算法分析的「原始素材」
//   - P13 自適應閾值：分析失敗率調整參數
//   - P15 內容健康度：找「死路 page」（玩家進去就退出）
//   - P16 Markov：從成功流程提取 transition matrix
//
// 設計原則：
//   - 事件導向（event sourcing-like）
//   - 大量寫入優化（用 batch / async）
//   - 30 天後可歸檔（與 ai_result_cache 同樣理念）
import { pgTable, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { fields } from "./fields";

export const playerEventLogs = pgTable(
  "player_event_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** 場域 */
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    /** 遊戲 */
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** 任務頁面 ID（soft ref） */
    pageId: varchar("page_id", { length: 50 }),
    /** 玩家 session（同一場遊戲的所有事件共享） */
    sessionId: varchar("session_id"),
    /** 玩家 ID */
    userId: varchar("user_id"),
    /**
     * 事件類型：
     *   - 'page_enter'：進入頁面
     *   - 'page_complete'：完成頁面
     *   - 'page_exit'：玩家退出（沒完成）
     *   - 'page_retry'：重試
     *   - 'page_fail'：達失敗上限
     *   - 'page_skip'：跳過
     *   - 'ai_call'：呼叫 AI
     *   - 'cache_hit'：cache 命中
     *   - 'variant_shown'：顯示變體
     */
    eventType: varchar("event_type", { length: 30 }).notNull(),
    /** 事件詳細資料（jsonb，依 eventType 不同） */
    payload: jsonb("payload"),
    /** 事件持續時間（毫秒，可空：瞬時事件） */
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // 場域 + 時間：admin 看本月活動
    index("idx_events_field_time").on(table.fieldId, table.createdAt),
    // page + event：分析特定 page 的失敗率
    index("idx_events_page_action").on(table.pageId, table.eventType),
    // session：追蹤單場遊戲流程
    index("idx_events_session").on(table.sessionId),
    // 過期清理（30 天後）
    index("idx_events_created").on(table.createdAt),
  ],
);

export type PlayerEventLog = typeof playerEventLogs.$inferSelect;
export type InsertPlayerEventLog = typeof playerEventLogs.$inferInsert;

export const playerEventTypeEnum = [
  "page_enter",
  "page_complete",
  "page_exit",
  "page_retry",
  "page_fail",
  "page_skip",
  "ai_call",
  "cache_hit",
  "variant_shown",
] as const;
export type PlayerEventType = (typeof playerEventTypeEnum)[number];
