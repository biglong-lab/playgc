// 🔄 Markov 流程推薦 — page type 銜接統計表（Phase 16）
//
// 用途：
//   從成功玩家的歷史流程學「page type 銜接合理度」
//   後續用於：
//     - Roguelike composer：用機率排序模組（取代純隨機 shuffle）
//     - Admin Copilot suggestNextModule：將 Markov 機率注入 prompt 給 AI 參考
//
// 設計：
//   - 一筆紀錄 = 一個 (fieldId, fromType, toType) 三元組
//   - successCount：from→to 銜接後玩家「成功完成 to」的次數
//   - totalCount：from→to 銜接的總次數
//   - successRate = successCount / totalCount → 機率
//
// 訓練：
//   每週 cron task 7 從 player_event_logs 重新計算（資料量大，不需每天）
//
// 範圍限制：
//   - 第一版用 pageType（簡單）：text_card→photo_spot 是否合理？
//   - 不做更細粒度（如 pageType + difficulty）
//   - 不做 K-Markov（K>1）：先做最簡單的 1-step transition
//
// 預設行為：
//   - 表沒資料 → caller fallback 純隨機（向後相容）
import { pgTable, varchar, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fields } from "./fields";

export const pageTypeTransitions = pgTable(
  "page_type_transitions",
  {
    /** 場域 — 不同場域風格的銜接合理度可能不同；NULL 表示全平台統計 */
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "cascade",
    }),
    /** 起點 page type（如 text_card, photo_spot, qr_scan...） */
    fromType: varchar("from_type", { length: 50 }).notNull(),
    /** 終點 page type */
    toType: varchar("to_type", { length: 50 }).notNull(),
    /** 該銜接後成功完成「toType」的次數（玩家有 page_complete 事件） */
    successCount: integer("success_count").default(0).notNull(),
    /** 該銜接的總次數（玩家有 page_enter 事件 toType） */
    totalCount: integer("total_count").default(0).notNull(),
    /** 上次訓練時間 */
    lastTrainedAt: timestamp("last_trained_at").defaultNow(),
  },
  (table) => [
    // 複合主鍵：同一 (field, from, to) 只一筆
    primaryKey({
      name: "pk_transitions",
      columns: [table.fieldId, table.fromType, table.toType],
    }),
    // 查詢：給定 fromType 找所有 toType（給 sampler 用）
    index("idx_transitions_from").on(table.fieldId, table.fromType),
    // 查詢：訓練更新檢查
    index("idx_transitions_trained").on(table.lastTrainedAt),
  ],
);

export type PageTypeTransition = typeof pageTypeTransitions.$inferSelect;
export type InsertPageTypeTransition = typeof pageTypeTransitions.$inferInsert;

/**
 * Markov 機率（給 sampler / composer 用）
 * - probability = successCount / max(totalCount, 1)
 * - 0 = 從沒成功過 / 1 = 每次都成功
 */
export interface TransitionProbability {
  fromType: string;
  toType: string;
  successCount: number;
  totalCount: number;
  probability: number;
}
