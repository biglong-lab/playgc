// 📸 AI 結果快取（Hash-based 圖片快取）
//
// 設計理念：
//   - 玩家拍同一個景點（牌坊、碉堡等）時，第二位玩家不必再呼叫 AI
//   - 用 perceptual hash (pHash) 對相似圖片做相同 cache_key
//   - 只匹配「同一任務 ID」的快取（不會跨任務污染）
//
// cache_key 設計：
//   SHA-256(taskId + pHash + keywordsHash)
//   → pHash 對相同景物（角度光線略不同）會有相近 hash
//   → 距離 < 5 視為「同景點」，可命中快取
//
// TTL：30 天（admin 改任務後自動失效）
import { pgTable, varchar, integer, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { games } from "./games";
import { fields } from "./fields";

export const aiResultCache = pgTable(
  "ai_result_cache",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    /** 完整 cache key — SHA-256(taskId + pHashPrefix + keywordsHash) */
    cacheKey: varchar("cache_key", { length: 80 }).notNull().unique(),
    /** AI endpoint 名稱：'verify-photo' / 'compare-photos' */
    endpoint: varchar("endpoint", { length: 50 }).notNull(),
    /** 場域 ID（onDelete: set null 防止場域刪除時 cascade 太多） */
    fieldId: varchar("field_id").references(() => fields.id, {
      onDelete: "set null",
    }),
    /** 遊戲 ID */
    gameId: varchar("game_id").references(() => games.id, {
      onDelete: "cascade",
    }),
    /** 任務頁面 ID（pages.id；soft ref，不加 FK 防 cascade 問題） */
    taskId: varchar("task_id", { length: 50 }),
    /** 圖片 perceptual hash（16 hex chars，64-bit dHash） */
    pHash: varchar("p_hash", { length: 20 }),
    /** 玩家原始圖片 URL（給 P6 cron 策展素材庫用） */
    imageUrl: varchar("image_url", { length: 500 }),
    /** AI 回的完整結果（VerifyPhotoResult / CompareResult） */
    result: jsonb("result").notNull(),
    /** 命中次數（用於分析熱門景點） */
    hitCount: integer("hit_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    /** 最後一次命中時間 */
    lastHitAt: timestamp("last_hit_at"),
    /** 過期時間（30 天，每日 cron 清理） */
    expiresAt: timestamp("expires_at").notNull(),
  },
  (table) => [
    // 主查找：用 cacheKey 直接命中
    index("idx_ai_cache_key").on(table.cacheKey),
    // 場域 + 任務：列出某任務所有 cache（用於健康度分析）
    index("idx_ai_cache_field_task").on(table.fieldId, table.taskId),
    // pHash 模糊比對：找距離 < 5 的相似圖
    index("idx_ai_cache_task_phash").on(table.taskId, table.pHash),
    // 過期清理：cron 用
    index("idx_ai_cache_expires").on(table.expiresAt),
  ],
);

export type AiResultCache = typeof aiResultCache.$inferSelect;
export type InsertAiResultCache = typeof aiResultCache.$inferInsert;
