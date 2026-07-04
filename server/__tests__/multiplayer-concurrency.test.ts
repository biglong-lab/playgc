// 🧪 多人併發路徑測試（Phase C — 2026-07-04）
//
// 驗證四條「多人同時操作」防護路徑在衝突時的 handler 行為（mock 層級、不需真 DB）：
//   1. team-votes    重複投票被 UNIQUE + onConflictDoNothing 擋（insert 回空陣列 → 「已投過」）
//   2. team-race     advance 用 conditional UPDATE（WHERE current_question_index = expected）
//                    兩個併發 advance 只有一個成功
//   3. team-game-state  version 樂觀鎖 — 舊 version 寫入被拒（409 conflict）
//   4. team-scores   原子累加 — update set 收到 SQL 表達式而非讀後寫的絕對數字
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import request from "supertest";
import type { RouteContext } from "../routes/types";

// ─────────────────────────────────────────────────────
// 可組態的 db mock（vi.hoisted 確保 hoisted vi.mock 可存取）
// 設計：select / insert / update 依「資料表標記 __table」分流，
//       各表用「結果佇列」逐次出貨，模擬同一張表在一條 request 內被多次查詢
// ─────────────────────────────────────────────────────
const harness = vi.hoisted(() => {
  type Row = Record<string, unknown>;

  /** select 結果佇列（每次 from(table) 取一批；佇列空了回 fallback） */
  const selectQueues = new Map<string, Row[][]>();
  const selectFallbacks = new Map<string, Row[]>();
  /** insert ... returning 結果佇列 */
  const insertReturningQueues = new Map<string, Row[][]>();
  /** update ... returning 結果佇列 */
  const updateReturningQueues = new Map<string, Row[][]>();
  /** 紀錄 insert values / update set 的呼叫內容（供斷言） */
  const insertCalls: Array<{ table: string; values: Row }> = [];
  const updateSetCalls: Array<{ table: string; set: Row }> = [];

  function pushQueue(map: Map<string, Row[][]>, table: string, rows: Row[]): void {
    const queue = map.get(table) ?? [];
    queue.push(rows);
    map.set(table, queue);
  }

  function shiftQueue(map: Map<string, Row[][]>, table: string, fallback: Row[]): Row[] {
    const queue = map.get(table);
    if (queue && queue.length > 0) {
      const rows = queue.shift();
      return rows ?? fallback;
    }
    return fallback;
  }

  /** 建立「可 await 也可續接 .limit()」的查詢終端（answers 查詢沒接 .limit 直接 await） */
  function makeSelectTerminal(rows: Row[]) {
    return {
      where: () => ({
        limit: async () => rows,
        then: (
          onFulfilled: (value: Row[]) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(rows).then(onFulfilled, onRejected),
      }),
    };
  }

  const db = {
    query: {
      teamVotes: { findFirst: vi.fn() },
      teamSessions: { findFirst: vi.fn() },
    },
    select: vi.fn(() => ({
      from: (table: { __table: string }) =>
        makeSelectTerminal(
          shiftQueue(selectQueues, table.__table, selectFallbacks.get(table.__table) ?? []),
        ),
    })),
    insert: vi.fn((table: { __table: string }) => ({
      values: (values: Row) => {
        insertCalls.push({ table: table.__table, values });
        const returning = async () =>
          shiftQueue(insertReturningQueues, table.__table, []);
        return {
          onConflictDoNothing: () => ({ returning }),
          returning,
          // 直接 await（如 teamScoreHistory insert）→ resolve undefined
          then: (
            onFulfilled: (value: undefined) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => Promise.resolve(undefined).then(onFulfilled, onRejected),
        };
      },
    })),
    update: vi.fn((table: { __table: string }) => ({
      set: (setValues: Row) => {
        updateSetCalls.push({ table: table.__table, set: setValues });
        return {
          where: () => ({
            returning: async () =>
              shiftQueue(updateReturningQueues, table.__table, []),
            // 直接 await（如 teamVotes 完成標記）→ resolve undefined
            then: (
              onFulfilled: (value: undefined) => unknown,
              onRejected?: (reason: unknown) => unknown,
            ) => Promise.resolve(undefined).then(onFulfilled, onRejected),
          }),
        };
      },
    })),
    // team-game-state 走 raw SQL：db.execute(sql`...`)
    execute: vi.fn(),
  };

  return {
    db,
    insertCalls,
    updateSetCalls,
    queueSelect: (table: string, rows: Row[]) => pushQueue(selectQueues, table, rows),
    setSelectFallback: (table: string, rows: Row[]) => selectFallbacks.set(table, rows),
    queueInsertReturning: (table: string, rows: Row[]) =>
      pushQueue(insertReturningQueues, table, rows),
    queueUpdateReturning: (table: string, rows: Row[]) =>
      pushQueue(updateReturningQueues, table, rows),
    /** 清空所有佇列與呼叫紀錄（beforeEach 用） */
    resetAll: () => {
      selectQueues.clear();
      selectFallbacks.clear();
      insertReturningQueues.clear();
      updateReturningQueues.clear();
      insertCalls.length = 0;
      updateSetCalls.length = 0;
    },
  };
});

vi.mock("../db", () => ({ db: harness.db }));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: Request, res: Response, next: NextFunction) => {
    if (req.headers.authorization === "Bearer valid-token") {
      // 測試用最小 user 形狀（用 Object.assign 避免對完整 User 型別的依賴）
      Object.assign(req, {
        user: {
          claims: { sub: "user-1" },
          dbUser: { id: "user-1", displayName: "測試玩家" },
        },
      });
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

// Mock schema：各表用 __table 標記供 db mock 分流；欄位值只是佔位字串
vi.mock("@shared/schema", () => ({
  teams: { __table: "teams", id: "teams.id" },
  teamMembers: {
    __table: "teamMembers",
    id: "teamMembers.id",
    teamId: "teamMembers.teamId",
    userId: "teamMembers.userId",
    leftAt: "teamMembers.leftAt",
  },
  teamVotes: {
    __table: "teamVotes",
    id: "teamVotes.id",
    teamId: "teamVotes.teamId",
    status: "teamVotes.status",
    createdAt: "teamVotes.createdAt",
  },
  teamVoteBallots: {
    __table: "teamVoteBallots",
    voteId: "teamVoteBallots.voteId",
    userId: "teamVoteBallots.userId",
  },
  teamRaceStates: {
    __table: "teamRaceStates",
    teamId: "teamRaceStates.teamId",
    sessionId: "teamRaceStates.sessionId",
    pageId: "teamRaceStates.pageId",
    currentQuestionIndex: "teamRaceStates.currentQuestionIndex",
    resolvedAt: "teamRaceStates.resolvedAt",
  },
  teamRaceAnswers: {
    __table: "teamRaceAnswers",
    teamId: "teamRaceAnswers.teamId",
    sessionId: "teamRaceAnswers.sessionId",
    pageId: "teamRaceAnswers.pageId",
  },
  teamSessions: {
    __table: "teamSessions",
    id: "teamSessions.id",
    teamId: "teamSessions.teamId",
    createdAt: "teamSessions.createdAt",
    teamScore: "teamSessions.teamScore",
  },
  teamScoreHistory: {
    __table: "teamScoreHistory",
    teamId: "teamScoreHistory.teamId",
    createdAt: "teamScoreHistory.createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: string, b: string) => ({ op: "eq", a, b })),
  and: vi.fn((...conds: unknown[]) => ({ op: "and", conds })),
  desc: vi.fn((col: string) => ({ op: "desc", col })),
  isNull: vi.fn((col: string) => ({ op: "isNull", col })),
  // sql 標籤模板 → 可辨識標記物件（原子累加斷言用）
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    op: "sql",
    strings,
    values,
  })),
}));

import { registerTeamVoteRoutes } from "../routes/team-votes";
import { registerTeamRaceRoutes } from "../routes/team-race";
import { registerTeamGameStateRoutes } from "../routes/team-game-state";
import { registerTeamScoreRoutes } from "../routes/team-scores";

const AUTH = { Authorization: "Bearer valid-token" };

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx: RouteContext = {
    broadcastToSession: vi.fn(),
    broadcastToTeam: vi.fn(),
    broadcastToMatch: vi.fn(),
    broadcastToBattleSlot: vi.fn(),
  };
  registerTeamVoteRoutes(app, ctx);
  registerTeamRaceRoutes(app, ctx);
  registerTeamGameStateRoutes(app, ctx);
  registerTeamScoreRoutes(app, ctx);
  return { app, ctx };
}

describe("多人併發路徑（Phase C）", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.resetAll();
    harness.db.query.teamVotes.findFirst.mockReset();
    harness.db.query.teamSessions.findFirst.mockReset();
    harness.db.execute.mockReset();
    // 預設：user-1 是隊伍成員（isTeamMember / §19 防作弊檢查）
    harness.setSelectFallback("teamMembers", [{ id: "m-1", userId: "user-1", teamId: "team-1" }]);
    // 預設：無答題紀錄
    harness.setSelectFallback("teamRaceAnswers", []);
  });

  // ───────────────────────────────────────────────
  // 1. team-votes：重複投票被 UNIQUE onConflictDoNothing 擋
  // ───────────────────────────────────────────────
  describe("POST /api/votes/:voteId/cast — 重複投票防護", () => {
    /** 模擬「應用層 hasVoted 檢查通過、但 DB UNIQUE 已有同 user 選票」的併發窗口 */
    function mockActiveVote() {
      harness.db.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "majority",
        options: [
          { id: "option_0", label: "A" },
          { id: "option_1", label: "B" },
        ],
        team: {
          members: [
            { userId: "user-1" },
            { userId: "user-2" },
            { userId: "user-3" },
          ],
        },
        ballots: [], // 讀到的快照沒有自己的票（併發下另一請求剛插入）
      });
    }

    it("併發第二票：insert onConflictDoNothing 回空陣列 → 400「已投過」且不廣播", async () => {
      const { app, ctx } = createApp();
      mockActiveVote();
      // UNIQUE (voteId, userId) 衝突 → onConflictDoNothing → returning 空陣列
      harness.queueInsertReturning("teamVoteBallots", []);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set(AUTH)
        .send({ optionId: "option_0" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("已經投過票");
      // 被擋下的票不應觸發廣播、也不應寫入完成狀態
      expect(ctx.broadcastToTeam).not.toHaveBeenCalled();
      expect(
        harness.updateSetCalls.filter((c) => c.table === "teamVotes"),
      ).toHaveLength(0);
    });

    it("首票正常寫入：insert 回傳選票 → 200 success 並廣播 vote_cast", async () => {
      const { app, ctx } = createApp();
      mockActiveVote();
      harness.queueInsertReturning("teamVoteBallots", [
        { voteId: "vote-1", userId: "user-1", optionId: "option_0" },
      ]);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set(AUTH)
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // 3 人隊伍 1 票未過半 → 未完成
      expect(res.body.isComplete).toBe(false);
      expect(ctx.broadcastToTeam).toHaveBeenCalledWith(
        "team-1",
        expect.objectContaining({ type: "vote_cast", userId: "user-1", optionId: "option_0" }),
      );
    });
  });

  // ───────────────────────────────────────────────
  // 2. team-race：advance 用 conditional UPDATE 防併發推進
  // ───────────────────────────────────────────────
  describe("POST /api/team-race/advance — 併發推進只有一個成功", () => {
    const raceKey = { teamId: "team-1", sessionId: "s-1", pageId: "p-1" };
    const state0 = { ...raceKey, currentQuestionIndex: 0, totalQuestions: 5, status: "playing", resolvedAt: null };
    const state1 = { ...raceKey, currentQuestionIndex: 1, totalQuestions: 5, status: "playing", resolvedAt: null };

    it("第一個 advance 成功（UPDATE 命中 → 廣播）、第二個相同 expected 落空（不廣播、回最新 state）", async () => {
      const { app, ctx } = createApp();

      // ── 請求 1（搶先者）：state 讀到 index=0 → conditional UPDATE 命中 → 推進到 1
      harness.queueSelect("teamRaceStates", [state0]); // 進場 state 檢查
      harness.queueUpdateReturning("teamRaceStates", [state1]); // WHERE index=0 命中
      harness.queueSelect("teamRaceStates", [state1]); // 取最新 state

      const res1 = await request(app)
        .post("/api/team-race/advance")
        .set(AUTH)
        .send({ ...raceKey, expectedQuestionIndex: 0 });

      expect(res1.status).toBe(200);
      expect(res1.body.state.currentQuestionIndex).toBe(1);
      expect(ctx.broadcastToTeam).toHaveBeenCalledTimes(1);

      // ── 請求 2（併發輸家）：帶同樣 expected=0，但 DB 已是 index=1
      //    conditional UPDATE（WHERE current_question_index = 0）落空 → returning 空陣列
      harness.queueSelect("teamRaceStates", [state1]); // 進場 state 檢查（已被推進）
      harness.queueUpdateReturning("teamRaceStates", []); // WHERE 不命中
      harness.queueSelect("teamRaceStates", [state1]); // 取最新 state

      const res2 = await request(app)
        .post("/api/team-race/advance")
        .set(AUTH)
        .send({ ...raceKey, expectedQuestionIndex: 0 });

      // 落空者仍拿到 200 + 最新 state（idempotent），但不重複廣播
      expect(res2.status).toBe(200);
      expect(res2.body.state.currentQuestionIndex).toBe(1);
      expect(ctx.broadcastToTeam).toHaveBeenCalledTimes(1);
    });
  });

  // ───────────────────────────────────────────────
  // 3. team-game-state：version 樂觀鎖
  // ───────────────────────────────────────────────
  describe("POST /api/team-state — version 樂觀鎖", () => {
    const stateBody = {
      teamId: "team-1",
      sessionId: "s-1",
      pageId: "p-1",
      type: "lock_coop",
      state: { solved: [1, 2] },
    };
    const savedRow = {
      id: "gs-1",
      team_id: "team-1",
      session_id: "s-1",
      page_id: "p-1",
      component_type: "lock_coop",
      state_json: { solved: [1, 2, 3] },
      version: 5,
      updated_at: "2026-07-04T00:00:00Z",
    };

    it("舊 version 寫入被拒：UPDATE 被 WHERE version < EXCLUDED.version 擋 → 409 conflict 且不廣播", async () => {
      const { app, ctx } = createApp();
      // upsert：rowCount 0 = 帶來的 version 不夠新、UPDATE 沒生效
      harness.db.execute.mockResolvedValueOnce({ rowCount: 0 });
      // fetchState：回 DB 現存（較新）的狀態
      harness.db.execute.mockResolvedValueOnce({ rows: [savedRow] });

      const res = await request(app)
        .post("/api/team-state")
        .set(AUTH)
        .send({ ...stateBody, version: 3 }); // 3 < 現存 5 → 舊狀態

      expect(res.status).toBe(409);
      expect(res.body.conflict).toBe(true);
      // 回應附上最新狀態、讓 client 拉回同步
      expect(res.body.state.version).toBe(5);
      expect(ctx.broadcastToTeam).not.toHaveBeenCalled();
    });

    it("新 version 寫入成功：UPDATE 生效 → 200 並廣播 team_state_updated", async () => {
      const { app, ctx } = createApp();
      harness.db.execute.mockResolvedValueOnce({ rowCount: 1 }); // upsert 生效
      harness.db.execute.mockResolvedValueOnce({ rows: [savedRow] }); // fetchState

      const res = await request(app)
        .post("/api/team-state")
        .set(AUTH)
        .send({ ...stateBody, version: 5 });

      expect(res.status).toBe(200);
      expect(res.body.state.version).toBe(5);
      expect(ctx.broadcastToTeam).toHaveBeenCalledWith(
        "team-1",
        expect.objectContaining({ type: "team_state_updated", version: 5 }),
      );
    });
  });

  // ───────────────────────────────────────────────
  // 4. team-scores：原子累加（DB 端 SQL 表達式、非讀後寫）
  // ───────────────────────────────────────────────
  describe("POST /api/teams/:teamId/score — 原子累加語意", () => {
    it("update set 的 teamScore 是 sql 表達式（COALESCE + delta），不是應用層算好的數字", async () => {
      const { app } = createApp();
      harness.db.query.teamSessions.findFirst.mockResolvedValueOnce({
        id: "session-1",
        teamId: "team-1",
        teamScore: 40,
      });
      // DB 端累加後的新值由 returning 回傳（40 + 10 = 50）
      harness.queueUpdateReturning("teamSessions", [{ teamScore: 50 }]);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set(AUTH)
        .send({ delta: 10, sourceType: "qr_scan" });

      expect(res.status).toBe(200);
      expect(res.body.newScore).toBe(50);

      // 核心斷言：set 收到 SQL 標記物件、而非 number（number = 讀後寫 = lost-update 風險）
      const scoreUpdate = harness.updateSetCalls.find((c) => c.table === "teamSessions");
      expect(scoreUpdate).toBeDefined();
      expect(typeof scoreUpdate?.set.teamScore).not.toBe("number");
      expect(scoreUpdate?.set.teamScore).toMatchObject({ op: "sql" });

      // 分數歷史 runningTotal 用 DB 回傳的累加結果（非本地推算）
      const historyInsert = harness.insertCalls.find((c) => c.table === "teamScoreHistory");
      expect(historyInsert?.values.runningTotal).toBe(50);
    });
  });
});
