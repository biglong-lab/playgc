// 🗄️ AI 快取歸檔（壓縮統計）
//
// 為什麼不直接刪除過期 cache？
//   - 細節 row 過 30 天命中率低（pHash 太相似的圖很少完全重複）
//   - 但「累積使用次數 + 平均 confidence」是有價值的歷史資產
//
// 歸檔策略（cron task 2）：
//   1. 找 expires_at < NOW() 的 ai_result_cache rows
//   2. 高 confidence (≥0.85) + 有 imageUrl → 已在 field_exemplar_photos？沒有則加
//   3. 累積統計到 ai_cache_archive（task_id × endpoint × 累計次數 × 平均 confidence）
//   4. DELETE 原 row（資料已被消化，空間節省）
//
// 這樣場域永遠累積「某任務歷史上有 N 次成功 / 平均信心 X」的資產，
// admin 在 /platform/ai-center 可看見，平台越玩越有資料底蘊。
import { pgTable, varchar, integer, decimal, timestamp, index, unique } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { fields } from "./fields";

export const aiCacheArchive = pgTable(
  "ai_cache_archive",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** 場域（onDelete: SET NULL 防 cascade 過大） */
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    /** 遊戲 */
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** 任務 ID（pages.id；soft ref） */
    taskId: varchar("task_id", { length: 50 }),
    /** AI endpoint */
    endpoint: varchar("endpoint", { length: 50 }).notNull(),
    /** 累計這個 task × endpoint 的歷史成功數 */
    totalCount: integer("total_count").default(0).notNull(),
    /** 累計 hit 次數（cache 被命中重用） */
    totalHits: integer("total_hits").default(0).notNull(),
    /** 平均 confidence（累計 / total_count） */
    avgConfidence: decimal("avg_confidence", { precision: 4, scale: 3 }),
    /** 最高 confidence */
    maxConfidence: decimal("max_confidence", { precision: 4, scale: 3 }),
    /** 最早見到的時間（從 archive 起算） */
    firstSeenAt: timestamp("first_seen_at"),
    /** 最近一次 archive 累積的時間 */
    lastArchivedAt: timestamp("last_archived_at").defaultNow(),
  },
  (table) => [
    // 一個 task × endpoint 一筆紀錄（每次 archive 累加）
    unique("uniq_archive_task_endpoint").on(table.taskId, table.endpoint),
    index("idx_archive_field").on(table.fieldId),
    index("idx_archive_game").on(table.gameId),
  ],
);

export type AiCacheArchive = typeof aiCacheArchive.$inferSelect;
export type InsertAiCacheArchive = typeof aiCacheArchive.$inferInsert;
