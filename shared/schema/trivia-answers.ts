// 🏆 Trivia Answers — TriviaShowdown server-side scoring（Phase 4 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §7
// ADR-0018 規則 4：計分 / 排名 / 結算結果 → server-side source-of-truth
//
// 用途：
//   - 取代原 TriviaShowdown 的 client 端計分（ws 漏接 = 不公平）
//   - 每位玩家答題進 DB、server 算 rank + score
//   - 爭議仲裁可查 DB（Phase 0.3 Replay UI）
//
// 業務邏輯：
//   - 玩家答題：POST /api/trivia/:sessionId/answer
//   - server 寫 DB + 計算 rank（同 question 之前答對的人數）+ 算 score
//   - 同 user 同 question 只能答 1 次（unique constraint）
//   - server broadcast host_screen_state 給大螢幕端

import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const triviaAnswers = pgTable(
  "trivia_answers",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id", { length: 100 }).notNull(),
    questionId: varchar("question_id", { length: 100 }).notNull(),
    userId: varchar("user_id", { length: 100 }).notNull(),
    userName: varchar("user_name", { length: 200 }).notNull(),
    choice: integer("choice").notNull(),       // 0-3 選項 index
    isCorrect: boolean("is_correct").notNull(),
    rankAtCorrect: integer("rank_at_correct"), // 答對排名（第 1 / 2 / 3...）；答錯為 null
    scoreAwarded: integer("score_awarded").notNull().default(0),
    answeredAt: timestamp("answered_at").defaultNow().notNull(),
  },
  (table) => [
    // 同 user 同 question 只能 1 次
    uniqueIndex("trivia_session_q_user_unique").on(
      table.sessionId,
      table.questionId,
      table.userId,
    ),
    index("trivia_session_idx").on(table.sessionId),
    index("trivia_session_q_idx").on(table.sessionId, table.questionId),
  ],
);

export const insertTriviaAnswerSchema = createInsertSchema(triviaAnswers).omit({
  id: true,
  answeredAt: true,
});
export type TriviaAnswer = typeof triviaAnswers.$inferSelect;
export type InsertTriviaAnswer = z.infer<typeof insertTriviaAnswerSchema>;

// API request schema（玩家 POST）
export const triviaAnswerRequestSchema = z.object({
  questionId: z.string().min(1).max(100),
  choice: z.number().int().min(0).max(20),
  correctIdx: z.number().int().min(0).max(20),
  scoreByRank: z.array(z.number().int().min(0).max(10000)).min(1).max(20).optional(),
  userId: z.string().min(1).max(100),
  userName: z.string().min(1).max(200),
});
export type TriviaAnswerRequest = z.infer<typeof triviaAnswerRequestSchema>;
