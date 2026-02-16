/**
 * 對戰路由 API 整合測試 — matches.ts
 *
 * Mock 策略：Drizzle 鏈式呼叫 select().from().where().orderBy()
 * 每次 select() 呼叫按順序回傳 mockSelectResults 陣列中的下一個值。
 * 呼叫鏈會在最終方法（where / orderBy）解析為 Promise。
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── 可控的回傳佇列 ─────────────────────────────────
let selectResults: unknown[][] = [];
let selectIndex = 0;

const mockInsertReturning = vi.fn();
const mockUpdateReturning = vi.fn();

/** 取得下一筆 select 回傳值（按呼叫順序消費） */
function nextSelectResult() {
  const result = selectResults[selectIndex] ?? [];
  selectIndex++;
  return result;
}

/** 建立一個 thenable chain 物件，末端 resolve nextSelectResult */
function createSelectChain() {
  const chain: Record<string, unknown> = {};

  // where() 可接 orderBy()，也可直接 await
  const makeThenable = () => {
    const thenable = {
      orderBy: vi.fn(() => Promise.resolve(nextSelectResult())),
      then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
        Promise.resolve(nextSelectResult()).then(resolve, reject),
    };
    return thenable;
  };

  chain.from = vi.fn(() => ({
    where: vi.fn(() => makeThenable()),
    orderBy: vi.fn(() => Promise.resolve(nextSelectResult())),
  }));

  return chain;
}

vi.mock("../db", () => ({
  db: {
    select: vi.fn(() => createSelectChain()),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => {
          // where() 回傳同時可 await（thenable）也可呼叫 .returning()
          const whereResult = {
            returning: mockUpdateReturning,
            then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
              Promise.resolve().then(resolve, reject),
          };
          return whereResult;
        }),
      })),
    })),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

// Mock relay 子路由（避免 relay 也試圖註冊路由）
vi.mock("../routes/relay", () => ({
  registerRelayRoutes: vi.fn(),
}));

import { registerMatchRoutes } from "../routes/matches";

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = {
    broadcastToSession: vi.fn(),
    broadcastToTeam: vi.fn(),
    broadcastToMatch: vi.fn(),
  };
  registerMatchRoutes(app, ctx);
  return { app, ctx };
}

describe("對戰路由 API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    selectResults = [];
    selectIndex = 0;
  });

  // ────────────────────────────────────────────────────
  // POST /api/games/:gameId/matches — 建立對戰
  // ────────────────────────────────────────────────────
  describe("POST /api/games/:gameId/matches — 建立對戰", () => {
    it("成功建立對戰", async () => {
      const { app } = createApp();
      // select #0: 遊戲存在
      selectResults = [[{ id: "a0000000-0000-4000-8000-000000000001", title: "測試" }]];
      mockInsertReturning.mockResolvedValueOnce([{
        id: "b0000000-0000-4000-8000-000000000001",
        gameId: "a0000000-0000-4000-8000-000000000001",
        status: "waiting",
        accessCode: "ABC123",
      }]);

      const res = await request(app)
        .post("/api/games/a0000000-0000-4000-8000-000000000001/matches")
        .set("Authorization", "Bearer valid-token")
        .send({ matchMode: "competitive" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("b0000000-0000-4000-8000-000000000001");
    });

    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/games/a0000000-0000-4000-8000-000000000001/matches")
        .send({});

      expect(res.status).toBe(401);
    });

    it("遊戲不存在時回傳 404", async () => {
      const { app } = createApp();
      // select #0: 遊戲不存在
      selectResults = [[]];

      const res = await request(app)
        .post("/api/games/a0000000-0000-4000-8000-000000000001/matches")
        .set("Authorization", "Bearer valid-token")
        .send({ matchMode: "competitive" });

      expect(res.status).toBe(404);
    });

    it("無效 matchMode 回傳 400", async () => {
      const { app } = createApp();

      const res = await request(app)
        .post("/api/games/a0000000-0000-4000-8000-000000000001/matches")
        .set("Authorization", "Bearer valid-token")
        .send({ matchMode: "invalid" });

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/games/:gameId/matches — 對戰列表
  // ────────────────────────────────────────────────────
  describe("GET /api/games/:gameId/matches — 對戰列表", () => {
    it("回傳對戰列表", async () => {
      const { app } = createApp();
      const matches = [
        { id: "m1", status: "waiting" },
        { id: "m2", status: "playing" },
      ];
      // 此端點使用 .where().orderBy() — select #0
      selectResults = [matches];

      const res = await request(app)
        .get("/api/games/a0000000-0000-4000-8000-000000000001/matches");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/matches/:matchId — 對戰詳情
  // ────────────────────────────────────────────────────
  describe("GET /api/matches/:matchId — 對戰詳情", () => {
    it("對戰存在時回傳詳情", async () => {
      const { app } = createApp();
      // select #0: match 存在（where 呼叫）
      // select #1: participants（where().orderBy()）
      selectResults = [
        [{ id: "b0000000-0000-4000-8000-000000000001", status: "waiting" }],
        [{ userId: "u1", currentScore: 100 }],
      ];

      const res = await request(app)
        .get("/api/matches/b0000000-0000-4000-8000-000000000001");

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("b0000000-0000-4000-8000-000000000001");
    });

    it("對戰不存在時回傳 404", async () => {
      const { app } = createApp();
      selectResults = [[]];

      const res = await request(app)
        .get("/api/matches/nonexistent");

      expect(res.status).toBe(404);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/join — 加入對戰
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/join — 加入對戰", () => {
    it("成功加入對戰", async () => {
      const { app, ctx } = createApp();
      // select #0: match
      // select #1: existing check (empty)
      // select #2: all participants (count check)
      selectResults = [
        [{ id: "b0000000-0000-4000-8000-000000000001", status: "waiting", maxTeams: 10 }],
        [],
        [],
      ];

      mockInsertReturning.mockResolvedValueOnce([{
        id: "participant-1",
        matchId: "b0000000-0000-4000-8000-000000000001",
        userId: "user-1",
      }]);

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/join")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(201);
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "b0000000-0000-4000-8000-000000000001",
        expect.objectContaining({ type: "match_participant_joined" }),
      );
    });

    it("對戰已開始時回傳 400", async () => {
      const { app } = createApp();
      selectResults = [[{ id: "b0000000-0000-4000-8000-000000000001", status: "playing" }]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/join")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
    });

    it("已加入時回傳 400", async () => {
      const { app } = createApp();
      selectResults = [
        [{ id: "b0000000-0000-4000-8000-000000000001", status: "waiting", maxTeams: 10 }],
        [{ userId: "user-1" }], // 已加入
      ];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/join")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/start — 開始對戰
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/start — 開始對戰", () => {
    it("建立者可以開始對戰", async () => {
      const { app, ctx } = createApp();
      selectResults = [[{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "waiting",
        creatorId: "user-1",
        settings: { countdownSeconds: 3 },
      }]];

      mockUpdateReturning.mockResolvedValueOnce([{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "countdown",
      }]);

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/start")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "b0000000-0000-4000-8000-000000000001",
        expect.objectContaining({ type: "match_countdown" }),
      );
    });

    it("非建立者不能開始", async () => {
      const { app } = createApp();
      selectResults = [[{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "waiting",
        creatorId: "other-user",
      }]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/start")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/finish — 結束對戰
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/finish — 結束對戰", () => {
    it("正在進行的對戰可以結束", async () => {
      const { app, ctx } = createApp();
      // select #0: match
      // select #1: participants (where().orderBy())
      selectResults = [
        [{ id: "b0000000-0000-4000-8000-000000000001", status: "playing" }],
        [
          { id: "p1", userId: "u1", currentScore: 100 },
          { id: "p2", userId: "u2", currentScore: 50 },
        ],
      ];

      // Promise.all 的 participant updates 不呼叫 .returning()（thenable resolve undefined）
      // 只有最後的 match update 呼叫 .returning()
      mockUpdateReturning.mockResolvedValueOnce([{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "finished",
      }]);

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/finish")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "b0000000-0000-4000-8000-000000000001",
        expect.objectContaining({ type: "match_finished" }),
      );
    });

    it("非 playing 狀態不能結束", async () => {
      const { app } = createApp();
      selectResults = [[{ id: "b0000000-0000-4000-8000-000000000001", status: "waiting" }]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/finish")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // PATCH /api/matches/:matchId/score — 更新分數
  // ────────────────────────────────────────────────────
  describe("PATCH /api/matches/:matchId/score — 更新分數", () => {
    it("成功更新分數並廣播排名", async () => {
      const { app, ctx } = createApp();
      // select #0: participant 查詢 (where with and)
      // select #1: 排名查詢 (where().orderBy())
      selectResults = [
        [{ id: "p1", matchId: "b0000000-0000-4000-8000-000000000001", userId: "user-1" }],
        [{ userId: "user-1", currentScore: 100 }],
      ];

      mockUpdateReturning.mockResolvedValueOnce([{
        id: "p1",
        currentScore: 100,
      }]);

      const res = await request(app)
        .patch("/api/matches/b0000000-0000-4000-8000-000000000001/score")
        .set("Authorization", "Bearer valid-token")
        .send({ score: 100 });

      expect(res.status).toBe(200);
      expect(ctx.broadcastToMatch).toHaveBeenCalled();
    });

    it("未加入對戰回傳 404", async () => {
      const { app } = createApp();
      selectResults = [[]];

      const res = await request(app)
        .patch("/api/matches/b0000000-0000-4000-8000-000000000001/score")
        .set("Authorization", "Bearer valid-token")
        .send({ score: 100 });

      expect(res.status).toBe(404);
    });

    it("缺少 score 回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .patch("/api/matches/b0000000-0000-4000-8000-000000000001/score")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────
  // GET /api/matches/:matchId/ranking — 即時排名
  // ────────────────────────────────────────────────────
  describe("GET /api/matches/:matchId/ranking — 即時排名", () => {
    it("回傳排名列表", async () => {
      const { app } = createApp();
      // 此端點使用 where().orderBy() — select #0
      selectResults = [[
        { userId: "u1", currentScore: 100, teamId: null, relaySegment: null, relayStatus: null },
        { userId: "u2", currentScore: 50, teamId: null, relaySegment: null, relayStatus: null },
      ]];

      const res = await request(app)
        .get("/api/matches/b0000000-0000-4000-8000-000000000001/ranking");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].rank).toBe(1);
    });
  });

  // ────────────────────────────────────────────────────
  // POST /api/matches/:matchId/recover — 恢復卡住的倒數
  // ────────────────────────────────────────────────────
  describe("POST /api/matches/:matchId/recover — 恢復倒數", () => {
    it("超過倒數時間的 countdown 狀態可恢復為 playing", async () => {
      const { app, ctx } = createApp();
      // 6 秒前的時間（超過 3+2=5 秒容錯）
      const sixSecondsAgo = new Date(Date.now() - 6000);
      selectResults = [[{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "countdown",
        settings: { countdownSeconds: 3 },
        updatedAt: sixSecondsAgo.toISOString(),
      }]];

      mockUpdateReturning.mockResolvedValueOnce([{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "playing",
      }]);

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/recover")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("playing");
      expect(ctx.broadcastToMatch).toHaveBeenCalledWith(
        "b0000000-0000-4000-8000-000000000001",
        expect.objectContaining({ type: "match_started", recovered: true }),
      );
    });

    it("倒數尚未超時時回傳 400", async () => {
      const { app } = createApp();
      // 剛剛才進入 countdown
      selectResults = [[{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "countdown",
        settings: { countdownSeconds: 3 },
        updatedAt: new Date().toISOString(),
      }]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/recover")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("倒數尚未超時");
    });

    it("非 countdown 狀態回傳 400", async () => {
      const { app } = createApp();
      selectResults = [[{
        id: "b0000000-0000-4000-8000-000000000001",
        status: "playing",
      }]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/recover")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(400);
      expect(res.body.error).toBe("對戰不在倒數狀態");
    });

    it("對戰不存在時回傳 404", async () => {
      const { app } = createApp();
      selectResults = [[]];

      const res = await request(app)
        .post("/api/matches/b0000000-0000-4000-8000-000000000001/recover")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(404);
    });
  });
});
