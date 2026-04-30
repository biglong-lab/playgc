// 🖼️ 場域素材庫（Field Exemplar Photos）
//
// 用途：
//   累積場域內的「優質玩家照片」變成下次玩家的範本
//   1. 玩家拍照通過 AI 驗證 confidence > 0.85 → cron 自動加入
//   2. admin 也可手動上傳「標準範本」
//   3. compare-photos 除了比對 admin 設定的參考圖，也可參考素材庫
//
// 三個資料來源（source 欄位）：
//   - 'player_success'：玩家成功照（cron 策展）
//   - 'admin_upload'：admin 親自上傳
//   - 'cron_collected'：每日策展腳本
//
// is_curated：admin 親選的優質範本（未來 compare-photos 優先使用）
import { pgTable, varchar, integer, decimal, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { fields } from "./fields";
import { games } from "./games";

export const fieldExemplarPhotos = pgTable(
  "field_exemplar_photos",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    /** 對應的遊戲（可能 null：場域層通用素材） */
    gameId: varchar("game_id").references(() => games.id, { onDelete: "cascade" }),
    /** 對應的任務頁面（pages.id；soft ref） */
    pageId: varchar("page_id", { length: 50 }),
    /** 圖片 URL（Cloudinary） */
    photoUrl: varchar("photo_url", { length: 500 }).notNull(),
    /** AI 評分 confidence（0-1，0.85+ 才會被自動策展） */
    confidence: decimal("confidence", { precision: 3, scale: 2 }),
    /** 來源：player_success / admin_upload / cron_collected */
    source: varchar("source", { length: 20 }).notNull(),
    /** admin 標記為「優質範本」(未來 compare-photos 優先用) */
    isCurated: boolean("is_curated").default(false).notNull(),
    /** 標籤（admin 加註，例：「夕陽」「正面」「霧天」） */
    tags: varchar("tags", { length: 200 }),
    /** 玩家或 admin 給的描述 */
    description: varchar("description", { length: 300 }),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [
    // 場域 + 遊戲查詢（admin 後台列表）
    index("idx_exemplar_field_game").on(table.fieldId, table.gameId),
    // 任務查詢（compare-photos 找特定 page 的範本）
    index("idx_exemplar_page").on(table.pageId),
    // is_curated 篩選（找「精選」範本）
    index("idx_exemplar_curated").on(table.fieldId, table.isCurated),
    // confidence 排序（找最高品質範本）
    index("idx_exemplar_confidence").on(table.fieldId, table.confidence),
  ],
);

export type FieldExemplarPhoto = typeof fieldExemplarPhotos.$inferSelect;
export type InsertFieldExemplarPhoto = typeof fieldExemplarPhotos.$inferInsert;

export type ExemplarSource = "player_success" | "admin_upload" | "cron_collected";
