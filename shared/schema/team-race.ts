// 🏃 team_race — ChoiceVerifyRace 多人搶答持久化（2026-05-05）
//
// 解決問題：
//   - 玩家重整 → currentQIndex / answerRecords 全丟、變成可重答
//   - 兩個玩家進度不同步、答題進度各自跑
//   - 30 秒固定倒數太久 — 改「有人答對 5 秒後」推進
//
// 設計：
//   team_race_states：每隊 × 每 page 一筆、追蹤目前題號 + 開始/解決時間
//   team_race_answers：每位玩家每題一筆（UNIQUE 防重答）
//
// 推進邏輯：
//   1. 第一個答對 → server 設 resolved_at=NOW()
//   2. Client UI 倒數 5 秒
//   3. 任一 client 5 秒後送 POST advance → server conditional UPDATE
//      WHERE current_question_index = ? → 第一個成功、其他衝突 idempotent

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const teamRaceStates = pgTable(
  "team_race_states",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id").notNull(),
    sessionId: varchar("session_id").notNull(),
    pageId: varchar("page_id").notNull(),
    currentQuestionIndex: integer("current_question_index").notNull().default(0),
    totalQuestions: integer("total_questions").notNull(),
    secondsPerQuestion: integer("seconds_per_question").notNull().default(30),
    /** 5 秒推進冷卻時間（有人答對後） */
    advanceCooldownSeconds: integer("advance_cooldown_seconds").notNull().default(5),
    questionStartedAt: timestamp("question_started_at").notNull().defaultNow(),
    /** 有人答對時的時間戳；null = 該題尚未解決 */
    resolvedAt: timestamp("resolved_at"),
    status: varchar("status", { length: 20 }).notNull().default("playing"), // playing | completed
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_team_race_states").on(
      table.teamId,
      table.sessionId,
      table.pageId,
    ),
  ],
);

export const teamRaceAnswers = pgTable(
  "team_race_answers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    teamId: varchar("team_id").notNull(),
    sessionId: varchar("session_id").notNull(),
    pageId: varchar("page_id").notNull(),
    userId: varchar("user_id").notNull(),
    displayName: varchar("display_name").notNull(),
    questionIndex: integer("question_index").notNull(),
    selectedOption: integer("selected_option").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    points: integer("points").notNull().default(0),
    answeredAt: timestamp("answered_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("uniq_team_race_answers").on(
      table.teamId,
      table.sessionId,
      table.pageId,
      table.userId,
      table.questionIndex,
    ),
    index("idx_team_race_answers_lookup").on(
      table.teamId,
      table.sessionId,
      table.pageId,
    ),
  ],
);

export type TeamRaceState = typeof teamRaceStates.$inferSelect;
export type TeamRaceAnswer = typeof teamRaceAnswers.$inferSelect;
