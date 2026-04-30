// 📊 玩家反饋訊號收集
//
// 用途：玩家對「變體訊息」的 like/dislike/skip，是「自我學習迴路」的核心訊號
//
// 用法：
//   - 玩家成功通過任務時，toast 旁顯示「👍 / 👎」按鈕
//   - 玩家點擊 → POST /api/player/feedback → 寫入此表
//   - cron 統計 / Multi-Armed Bandit 演算法依此打磨變體池
//
// 設計：
//   - variantId 不是 FK（變體存在 pages.variantPool JSONB 內，沒獨立表）
//     → 用「pageId + variantKey + variantIndex」三段式 key 標識
//   - userId 可空（匿名玩家也能反饋，但 unique key 會放寬）
import { pgTable, varchar, integer, timestamp, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { fields } from "./fields";

export const variantFeedback = pgTable(
  "variant_feedback",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** 場域（用於 admin 篩選） */
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    /** 遊戲 */
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** 任務頁面 ID */
    pageId: varchar("page_id", { length: 50 }).notNull(),
    /** 變體類別：success / fail / nearMiss / hint */
    variantKey: varchar("variant_key", { length: 20 }).notNull(),
    /** 變體在陣列中的 index（0-based） */
    variantIndex: integer("variant_index").notNull(),
    /** 變體訊息原文（snapshot，避免 admin 改動後對不上） */
    variantText: varchar("variant_text", { length: 500 }),
    /** 玩家動作：like / dislike / skip */
    action: varchar("action", { length: 10 }).notNull(),
    /** 玩家 ID（可空：匿名玩家） */
    userId: varchar("user_id"),
    /** 玩家 session（同 user 同 page 多次反饋以最新一次為準） */
    sessionId: varchar("session_id"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // 同一 user × 同一 variant 只記最新一筆（用 INSERT ... ON CONFLICT 處理）
    unique("uniq_feedback_user_variant").on(
      table.userId,
      table.pageId,
      table.variantKey,
      table.variantIndex,
    ),
    // 統計用：找某 page 所有反饋
    index("idx_feedback_page").on(table.pageId, table.variantKey),
    // 場域維度
    index("idx_feedback_field").on(table.fieldId),
    // 時間維度（看趨勢）
    index("idx_feedback_created").on(table.createdAt),
  ],
);

export type VariantFeedback = typeof variantFeedback.$inferSelect;
export type InsertVariantFeedback = typeof variantFeedback.$inferInsert;

export const feedbackActionEnum = ["like", "dislike", "skip"] as const;
export type FeedbackAction = (typeof feedbackActionEnum)[number];
