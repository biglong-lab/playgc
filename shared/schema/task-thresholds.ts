// 🎯 自適應閾值（每個任務的演算法參數自動學習）
//
// 用途：
//   原本系統的閾值（pHash 距離、Levenshtein tolerance、AI confidence）寫死，
//   不同類型任務應該有不同最佳值。本表讓每個 task（page）依歷史資料自動調整。
//
// 範例：
//   任務 A（古蹟拍照）— 玩家拍很相近，pHash 5 太嚴 → 自動調到 8
//   任務 B（特殊景物）— 玩家容易拍錯，pHash 5 太鬆 → 自動調到 3
//   任務 C（簡單問答）— 玩家答案多元，fuzzy tolerance 2 太嚴 → 自動調到 4
//
// 自動更新：
//   每天 cron 跑 task 4 → 從歷史 ai_usage_logs / player_event_logs 算最佳值
//   updated_at 紀錄上次重算時間
//
// 預設行為：
//   未在此表 → 走 system default（pHash=5, fuzzy=2, confidence=0.6）
//   即「opt-in」設計，向後相容
import { pgTable, varchar, integer, decimal, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";

export const taskThresholds = pgTable(
  "task_thresholds",
  {
    /** task_id = pages.id（unique） */
    taskId: varchar("task_id", { length: 50 }).primaryKey(),
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** P4 圖片快取 pHash 距離閾值（預設 5）— 越小越嚴 */
    pHashThreshold: integer("p_hash_threshold"),
    /** P3 智慧分流 Levenshtein 容忍度（預設 2）— 越大越鬆 */
    fuzzyTolerance: integer("fuzzy_tolerance"),
    /** verify-photo AI confidence 通過閾值（預設 0.6）— 越高越嚴 */
    aiConfidenceThreshold: decimal("ai_confidence_threshold", { precision: 3, scale: 2 }),
    /** compare-photos similarity 通過閾值（預設 0.6） */
    similarityThreshold: decimal("similarity_threshold", { precision: 3, scale: 2 }),
    /** 統計 metadata（給 admin 看為何這樣調） */
    stats: jsonb("stats"),
    /** 上次重算時間 */
    updatedAt: timestamp("updated_at").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    index("idx_thresholds_game").on(table.gameId),
    index("idx_thresholds_updated").on(table.updatedAt),
  ],
);

export type TaskThreshold = typeof taskThresholds.$inferSelect;
export type InsertTaskThreshold = typeof taskThresholds.$inferInsert;

/** 系統預設閾值（無 task_thresholds row 時用） */
export const DEFAULT_THRESHOLDS = {
  pHashThreshold: 5,
  fuzzyTolerance: 2,
  aiConfidenceThreshold: 0.6,
  similarityThreshold: 0.6,
} as const;
