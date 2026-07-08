// 🏃 team-race — ChoiceVerifyRace 多人搶答 server-side 持久化（2026-05-05）
//
// 端點：
//   GET  /api/team-race/state            ?teamId=&sessionId=&pageId=
//   POST /api/team-race/state            建立或讀取（idempotent upsert）
//   POST /api/team-race/answer           送答題（防重答 UNIQUE）
//   POST /api/team-race/advance          推進下一題（conditional UPDATE 防 race）
//
// 解決問題：
//   - 重整 → state 在 DB、不會重來
//   - 答題進度同步 → server 統一 currentQuestionIndex、ws broadcast
//   - 防重答 → DB UNIQUE (teamId, sessionId, pageId, userId, questionIndex)
//   - 5 秒推進 → client 倒數 → POST advance；server conditional UPDATE 防多人 advance race
//
// WebSocket broadcast：
//   - race_state_updated  { state }   全隊狀態變化
//   - race_answer_recorded { answer } 有人答題

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import { teamRaceStates, teamRaceAnswers, teamMembers } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { RouteContext, AuthenticatedRequest } from "./types";
// 🔐 2026-07-09 S2：isTeamMember 統一到 lib/team-membership（原 5 檔各自複製、易漏）
import { isTeamMember } from "../lib/team-membership";

/**
 * 啟動時 ensure schema — raw SQL CREATE IF NOT EXISTS
 * 不依賴 drizzle-kit migration、生產直接生效
 */
export async function ensureTeamRaceSchema(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_race_states (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      current_question_index INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL,
      seconds_per_question INTEGER NOT NULL DEFAULT 30,
      advance_cooldown_seconds INTEGER NOT NULL DEFAULT 5,
      question_started_at TIMESTAMP NOT NULL DEFAULT NOW(),
      resolved_at TIMESTAMP,
      status VARCHAR(20) NOT NULL DEFAULT 'playing',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_race_states
    ON team_race_states (team_id, session_id, page_id)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS team_race_answers (
      id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
      team_id VARCHAR NOT NULL,
      session_id VARCHAR NOT NULL,
      page_id VARCHAR NOT NULL,
      user_id VARCHAR NOT NULL,
      display_name VARCHAR NOT NULL,
      question_index INTEGER NOT NULL,
      selected_option INTEGER NOT NULL,
      is_correct BOOLEAN NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      answered_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_team_race_answers
    ON team_race_answers (team_id, session_id, page_id, user_id, question_index)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_team_race_answers_lookup
    ON team_race_answers (team_id, session_id, page_id)
  `);
}

/** 驗 user 在該 team 是否為 active member（防偽造） */
const stateQuerySchema = z.object({
  teamId: z.string().min(1),
  sessionId: z.string().min(1),
  pageId: z.string().min(1),
});

const upsertStateSchema = stateQuerySchema.extend({
  totalQuestions: z.number().int().min(1).max(100),
  secondsPerQuestion: z.number().int().min(5).max(120).optional(),
  advanceCooldownSeconds: z.number().int().min(1).max(30).optional(),
});

const answerSchema = stateQuerySchema.extend({
  questionIndex: z.number().int().min(0),
  selectedOption: z.number().int().min(0),
  isCorrect: z.boolean(),
  points: z.number().int().min(0).max(1000),
  displayName: z.string().min(1).max(100),
});

const advanceSchema = stateQuerySchema.extend({
  expectedQuestionIndex: z.number().int().min(0),
});

export function registerTeamRaceRoutes(app: Express, ctx: RouteContext): void {
  /**
   * GET /api/team-race/state
   *   ?teamId=&sessionId=&pageId=
   * 拉當前 state + 所有 answers（重整時用）
   */
  app.get(
    "/api/team-race/state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = stateQuerySchema.safeParse(req.query);
        if (!parsed.success) {
          return res.status(400).json({ message: "參數錯誤" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const { teamId, sessionId, pageId } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        const [state] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);

        if (!state) {
          return res.json({ state: null, answers: [] });
        }

        const answers = await db
          .select()
          .from(teamRaceAnswers)
          .where(
            and(
              eq(teamRaceAnswers.teamId, teamId),
              eq(teamRaceAnswers.sessionId, sessionId),
              eq(teamRaceAnswers.pageId, pageId),
            ),
          );

        res.json({ state, answers });
      } catch (err) {
        console.error("[team-race] state get 失敗:", err);
        res.status(500).json({ message: "讀取狀態失敗" });
      }
    },
  );

  /**
   * POST /api/team-race/state
   * 建立或讀取（idempotent upsert）— 玩家進場時呼叫
   */
  app.post(
    "/api/team-race/state",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = upsertStateSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "參數錯誤", errors: parsed.error.errors });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const {
          teamId, sessionId, pageId, totalQuestions,
          secondsPerQuestion = 30, advanceCooldownSeconds = 5,
        } = parsed.data;

        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        // INSERT ... ON CONFLICT DO NOTHING — 第一個進場 create，其他 idempotent
        await db
          .insert(teamRaceStates)
          .values({
            teamId,
            sessionId,
            pageId,
            totalQuestions,
            secondsPerQuestion,
            advanceCooldownSeconds,
            currentQuestionIndex: 0,
          })
          .onConflictDoNothing({
            target: [teamRaceStates.teamId, teamRaceStates.sessionId, teamRaceStates.pageId],
          });

        const [state] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);

        const answers = await db
          .select()
          .from(teamRaceAnswers)
          .where(
            and(
              eq(teamRaceAnswers.teamId, teamId),
              eq(teamRaceAnswers.sessionId, sessionId),
              eq(teamRaceAnswers.pageId, pageId),
            ),
          );

        res.json({ state, answers });
      } catch (err) {
        console.error("[team-race] state upsert 失敗:", err);
        res.status(500).json({ message: "建立狀態失敗" });
      }
    },
  );

  /**
   * POST /api/team-race/answer
   * 送答題（DB UNIQUE 防重答）
   * 第一個答對 → 設 resolved_at（給 UI 倒數用）
   */
  app.post(
    "/api/team-race/answer",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = answerSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "參數錯誤" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const {
          teamId, sessionId, pageId, questionIndex,
          selectedOption, isCorrect, points, displayName,
        } = parsed.data;

        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        // 先驗 state 存在
        const [state] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);
        if (!state) {
          return res.status(404).json({ message: "Race state 未建、請先 POST /state" });
        }

        // 驗 questionIndex 一致（防答錯題、可能 client 慢一拍）
        if (questionIndex !== state.currentQuestionIndex) {
          return res.status(409).json({
            message: "已不是當前題目",
            currentQuestionIndex: state.currentQuestionIndex,
          });
        }

        // INSERT 防重答（UNIQUE 衝突 → 已答過、idempotent 200）
        try {
          await db.insert(teamRaceAnswers).values({
            teamId,
            sessionId,
            pageId,
            userId,
            displayName,
            questionIndex,
            selectedOption,
            isCorrect,
            points,
          });
        } catch {
          // UNIQUE violation → 重複送、回傳當前 state 即可
          const answers = await db
            .select()
            .from(teamRaceAnswers)
            .where(
              and(
                eq(teamRaceAnswers.teamId, teamId),
                eq(teamRaceAnswers.sessionId, sessionId),
                eq(teamRaceAnswers.pageId, pageId),
              ),
            );
          return res.json({ state, answers, alreadyAnswered: true });
        }

        // 若是第一個答對 → 設 resolved_at（client UI 用此判斷 5 秒倒數起點）
        if (isCorrect && !state.resolvedAt) {
          await db
            .update(teamRaceStates)
            .set({ resolvedAt: new Date(), updatedAt: new Date() })
            .where(
              and(
                eq(teamRaceStates.teamId, teamId),
                eq(teamRaceStates.sessionId, sessionId),
                eq(teamRaceStates.pageId, pageId),
                isNull(teamRaceStates.resolvedAt),
              ),
            );
        }

        const [updatedState] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);

        const answers = await db
          .select()
          .from(teamRaceAnswers)
          .where(
            and(
              eq(teamRaceAnswers.teamId, teamId),
              eq(teamRaceAnswers.sessionId, sessionId),
              eq(teamRaceAnswers.pageId, pageId),
            ),
          );

        // WS broadcast 給全隊
        ctx.broadcastToTeam(teamId, {
          type: "race_state_updated",
          state: updatedState,
          answers,
        });

        res.json({ state: updatedState, answers });
      } catch (err) {
        console.error("[team-race] answer 失敗:", err);
        res.status(500).json({ message: "答題失敗" });
      }
    },
  );

  /**
   * POST /api/team-race/advance
   * 推進到下一題（5 秒倒數結束後 client 呼叫）
   * conditional UPDATE：WHERE current_question_index = expectedQuestionIndex
   * → 第一個 advance 成功、其他 race 衝突回 idempotent 當前 state
   */
  app.post(
    "/api/team-race/advance",
    isAuthenticated,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const parsed = advanceSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({ message: "參數錯誤" });
        }
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "請先登入" });

        const { teamId, sessionId, pageId, expectedQuestionIndex } = parsed.data;
        if (!(await isTeamMember(teamId, userId))) {
          return res.status(403).json({ message: "非隊伍成員" });
        }

        const [state] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);
        if (!state) {
          return res.status(404).json({ message: "Race state 不存在" });
        }

        // 已 completed → idempotent
        if (state.status === "completed") {
          const answers = await db
            .select()
            .from(teamRaceAnswers)
            .where(
              and(
                eq(teamRaceAnswers.teamId, teamId),
                eq(teamRaceAnswers.sessionId, sessionId),
                eq(teamRaceAnswers.pageId, pageId),
              ),
            );
          return res.json({ state, answers });
        }

        // conditional UPDATE — 防多人 advance race
        const isLastQuestion = expectedQuestionIndex >= state.totalQuestions - 1;
        const updateValues: Partial<typeof teamRaceStates.$inferInsert> = isLastQuestion
          ? {
              status: "completed",
              resolvedAt: null,
              updatedAt: new Date(),
            }
          : {
              currentQuestionIndex: expectedQuestionIndex + 1,
              questionStartedAt: new Date(),
              resolvedAt: null,
              updatedAt: new Date(),
            };

        const updated = await db
          .update(teamRaceStates)
          .set(updateValues)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
              eq(teamRaceStates.currentQuestionIndex, expectedQuestionIndex),
            ),
          )
          .returning();

        // 取最新 state（無論 update 是否生效）
        const [latestState] = await db
          .select()
          .from(teamRaceStates)
          .where(
            and(
              eq(teamRaceStates.teamId, teamId),
              eq(teamRaceStates.sessionId, sessionId),
              eq(teamRaceStates.pageId, pageId),
            ),
          )
          .limit(1);

        const answers = await db
          .select()
          .from(teamRaceAnswers)
          .where(
            and(
              eq(teamRaceAnswers.teamId, teamId),
              eq(teamRaceAnswers.sessionId, sessionId),
              eq(teamRaceAnswers.pageId, pageId),
            ),
          );

        // 若 update 生效 → broadcast 給全隊
        if (updated.length > 0) {
          ctx.broadcastToTeam(teamId, {
            type: "race_state_updated",
            state: latestState,
            answers,
          });
        }

        res.json({ state: latestState, answers });
      } catch (err) {
        console.error("[team-race] advance 失敗:", err);
        res.status(500).json({ message: "推進失敗" });
      }
    },
  );
}
