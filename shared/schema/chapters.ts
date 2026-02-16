// 章節系統 (Chapters) - 遊戲章節定義、玩家章節進度
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
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    index("idx_chapters_game_id").on(table.gameId),
    index("idx_chapters_order").on(table.gameId, table.chapterOrder),
  ]
);

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
