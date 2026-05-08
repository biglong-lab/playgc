// 🏆 Admin Trivia — TriviaShowdown server-side scoring（Phase 4 / 2026-05-08）
//
// 對應規劃：docs/changes/2026-05-08-multi-stability-refactor-plan.md §7
// ADR-0018 規則 4：計分 → server-side source-of-truth
//
// 端點：
//   POST /api/trivia/:sessionId/answer
//     body: { questionId, choice, correctIdx, scoreByRank, userId, userName }
//     - 寫入 trivia_answers（unique constraint：同 user 同 question 1 次）
//     - 計算 rank（同 question 之前答對的人數 + 1）
//     - 計算 score（依 scoreByRank[rank-1]、預設 [100, 75, 50, 25]）
//     - server broadcast host_screen_state 給該 session 所有 client（含大螢幕）
//
//   GET /api/trivia/:sessionId/state
//     回傳整 session 的 answered + scores（reconnect / replay 用）

import type { Express } from "express";
import { db } from "../db";
import { triviaAnswers, triviaAnswerRequestSchema } from "@shared/schema";
import { eq, and, count, desc } from "drizzle-orm";
import type { RouteContext } from "./types";

const DEFAULT_SCORE_BY_RANK = [100, 75, 50, 25];

interface SessionTriviaState {
  // 每位玩家累計分（Object.entries 排序給前端用）
  scores: Record<string, number>;
  // 本次最新一題的 answered map（給前端 UI 顯示）
  // shape: { [userName]: { choice, ts } }
  answered: Record<string, { choice: number; ts: number }>;
}

async function loadSessionState(sessionId: string): Promise<SessionTriviaState> {
  // 拉所有 answers
  const rows = await db
    .select()
    .from(triviaAnswers)
    .where(eq(triviaAnswers.sessionId, sessionId))
    .orderBy(desc(triviaAnswers.answeredAt));

  // 累計分
  const scores: Record<string, number> = {};
  for (const r of rows) {
    scores[r.userName] = (scores[r.userName] ?? 0) + r.scoreAwarded;
  }

  // 最新題的 answered map
  // 取最新 answeredAt 對應的 questionId、把該 question 所有 answers 列出
  let answered: Record<string, { choice: number; ts: number }> = {};
  if (rows.length > 0) {
    const latestQuestionId = rows[0].questionId;
    answered = rows
      .filter((r) => r.questionId === latestQuestionId)
      .reduce<Record<string, { choice: number; ts: number }>>((acc, r) => {
        acc[r.userName] = {
          choice: r.choice,
          ts: r.answeredAt instanceof Date ? r.answeredAt.getTime() : Date.now(),
        };
        return acc;
      }, {});
  }

  return { scores, answered };
}

export function registerAdminTriviaRoutes(app: Express, ctx: RouteContext) {
  // POST 玩家答題
  app.post("/api/trivia/:sessionId/answer", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const parsed = triviaAnswerRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "請求格式錯誤", details: parsed.error.flatten() });
      }
      const { questionId, choice, correctIdx, scoreByRank, userId, userName } = parsed.data;
      const isCorrect = choice === correctIdx;

      // 檢查同 user 同 question 是否已答
      const [existing] = await db
        .select({ id: triviaAnswers.id })
        .from(triviaAnswers)
        .where(
          and(
            eq(triviaAnswers.sessionId, sessionId),
            eq(triviaAnswers.questionId, questionId),
            eq(triviaAnswers.userId, userId),
          ),
        );
      if (existing) {
        // 已答過、回 conflict（client 端正常情況不會走到、雙保險）
        return res.status(409).json({ error: "已答過此題" });
      }

      // 計算 rank（同 question 之前答對的人數 + 1）
      let rankAtCorrect: number | null = null;
      let scoreAwarded = 0;
      if (isCorrect) {
        const [{ c }] = await db
          .select({ c: count() })
          .from(triviaAnswers)
          .where(
            and(
              eq(triviaAnswers.sessionId, sessionId),
              eq(triviaAnswers.questionId, questionId),
              eq(triviaAnswers.isCorrect, true),
            ),
          );
        rankAtCorrect = Number(c) + 1;
        const ranks = scoreByRank ?? DEFAULT_SCORE_BY_RANK;
        scoreAwarded = ranks[rankAtCorrect - 1] ?? ranks[ranks.length - 1] ?? 0;
      }

      // INSERT
      await db.insert(triviaAnswers).values({
        sessionId,
        questionId,
        userId,
        userName,
        choice,
        isCorrect,
        rankAtCorrect,
        scoreAwarded,
      });

      // 重新組裝 state + broadcast 給該 host session 所有 client
      const state = await loadSessionState(sessionId);
      ctx.broadcastToHostSession?.(sessionId, {
        type: "host_screen_state",
        sessionId,
        state,
      });

      res.json({
        ok: true,
        rankAtCorrect,
        scoreAwarded,
        isCorrect,
      });
    } catch (err) {
      console.error("[admin-trivia] POST answer failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "提交失敗" });
    }
  });

  // GET 取目前 state（reconnect / replay 用）
  app.get("/api/trivia/:sessionId/state", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const state = await loadSessionState(sessionId);
      res.json({ sessionId, state, generatedAt: new Date().toISOString() });
    } catch (err) {
      console.error("[admin-trivia] GET state failed:", err);
      res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
    }
  });
}
