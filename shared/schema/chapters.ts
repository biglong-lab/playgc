// 章節系統 (Chapters) - 遊戲章節定義、玩家章節進度、跨遊戲章節模板
import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { games } from "./games";
import { fields } from "./fields";
import { adminAccounts } from "./roles";

// ============================================================================
// Game Chapters 表 - 遊戲章節定義
// ============================================================================

// 章節解鎖類型
export const chapterUnlockTypeEnum = [
  "free",
  "complete_previous",
  "score_threshold",
  "paid",
] as const;
export type ChapterUnlockType = typeof chapterUnlockTypeEnum[number];

// 章節狀態
export const chapterStatusEnum = ["draft", "published", "hidden"] as const;
export type ChapterStatus = typeof chapterStatusEnum[number];

// 解鎖設定 JSONB 型別
export interface ChapterUnlockConfig {
  requiredScore?: number;
  requiredChapterId?: string;
  price?: number;
  currency?: string;
}

export const gameChapters = pgTable(
  "game_chapters",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    chapterOrder: integer("chapter_order").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    unlockType: varchar("unlock_type", { length: 20 }).default("complete_previous"),
    unlockConfig: jsonb("unlock_config").default({}),
    estimatedTime: integer("estimated_time"), // 分鐘
    status: varchar("status", { length: 20 }).default("draft"),
    // 章節是從哪個模板匯入的（僅做 provenance 紀錄，runtime 行為不受影響）
    // 管理員可看到這是「從 A 模板匯入的章節」，並可決定是否與最新模板同步
    sourceTemplateId: varchar("source_template_id"),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_chapters_game_id").on(table.gameId),
    index("idx_chapters_order").on(table.gameId, table.chapterOrder),
    index("idx_chapters_source_template").on(table.sourceTemplateId),
  ]
);

// ============================================================================
// Chapter Templates 表 - 場域層級章節模板（可跨遊戲重用）
// ============================================================================
//
// 設計理念：
//   - 場域（field）層級儲存，場域內所有遊戲可重用
//   - 模板存章節 metadata + pagesSnapshot（頁面內容快照）
//   - 匯入時複製到目標遊戲的 game_chapters + pages（per-game 獨立副本）
//   - 匯入後的章節是獨立的，可個別修改；模板修改不會自動同步（保持穩定）
//   - 紀錄 sourceTemplateId 可讓管理員之後手動同步更新
//
// 注意：
//   - pagesSnapshot 內的 locationId / itemId 是**原遊戲**的，匯入時需提示管理員重設
//   - 有了 P2.7 的 items.slug，未來可用 slug 自動對應同場域的 items

export const chapterTemplates = pgTable(
  "chapter_templates",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    fieldId: varchar("field_id")
      .references(() => fields.id, { onDelete: "cascade" })
      .notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),
    coverImageUrl: text("cover_image_url"),
    category: varchar("category", { length: 50 }), // 例：新手教學、戰鬥、劇情
    estimatedTime: integer("estimated_time"),
    unlockType: varchar("unlock_type", { length: 20 }).default("complete_previous"),
    unlockConfig: jsonb("unlock_config").default({}),
    // pages 快照（ChapterTemplatePagesSnapshot 型別，見下方）
    pagesSnapshot: jsonb("pages_snapshot").default([]).notNull(),
    // 來源章節（做溯源用；若來源章節被刪除，模板仍保留）
    sourceChapterId: varchar("source_chapter_id"),
    sourceGameId: varchar("source_game_id"),
    createdBy: varchar("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_chapter_templates_field").on(table.fieldId),
    index("idx_chapter_templates_category").on(table.fieldId, table.category),
  ]
);

/**
 * pagesSnapshot JSONB 結構
 * 注意：不含 id / gameId / chapterId，僅保留內容 — 匯入時會重新生成
 */
export interface ChapterTemplatePageSnapshot {
  pageOrder: number;
  pageType: string;
  config: Record<string, unknown>;
  // 警告旗標：若原 config 引用了 game-specific 的 id（locationId/itemId），
  // 匯入前會被標記出來讓管理員重設
  needsReconfigure?: boolean;
  /** 所引用的 entity 類型與 id（備援給 UI 提示用）*/
  references?: Array<{
    type: "location" | "item" | "achievement" | "chapter";
    id: string;
    slug?: string;
  }>;
}

// ============================================================================
// Player Chapter Progress 表 - 玩家章節進度
// ============================================================================

// 玩家章節狀態
export const chapterProgressStatusEnum = [
  "locked",
  "unlocked",
  "in_progress",
  "completed",
] as const;
export type ChapterProgressStatus = typeof chapterProgressStatusEnum[number];

export const playerChapterProgress = pgTable(
  "player_chapter_progress",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .references(() => users.id)
      .notNull(),
    gameId: varchar("game_id")
      .references(() => games.id, { onDelete: "cascade" })
      .notNull(),
    chapterId: varchar("chapter_id")
      .references(() => gameChapters.id, { onDelete: "cascade" })
      .notNull(),
    status: varchar("status", { length: 20 }).default("locked"),
    bestScore: integer("best_score").default(0),
    completedAt: timestamp("completed_at"),
    lastPlayedAt: timestamp("last_played_at"),
    chapterVariables: jsonb("chapter_variables").default({}),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_chapter_progress_user_game").on(table.userId, table.gameId),
    index("idx_chapter_progress_chapter").on(table.chapterId),
  ]
);

// ============================================================================
// Schemas & Types
// ============================================================================

export const insertGameChapterSchema = createInsertSchema(gameChapters).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertGameChapter = z.infer<typeof insertGameChapterSchema>;
export type GameChapter = typeof gameChapters.$inferSelect;

export const insertPlayerChapterProgressSchema = createInsertSchema(
  playerChapterProgress
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayerChapterProgress = z.infer<
  typeof insertPlayerChapterProgressSchema
>;
export type PlayerChapterProgress =
  typeof playerChapterProgress.$inferSelect;

// ============================================================================
// Chapter Templates schemas
// ============================================================================

export const insertChapterTemplateSchema = createInsertSchema(chapterTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertChapterTemplate = z.infer<typeof insertChapterTemplateSchema>;
export type ChapterTemplate = typeof chapterTemplates.$inferSelect;
