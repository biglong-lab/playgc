import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db（vi.hoisted 確保 hoisted vi.mock 可存取）
const { mockDb } = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  const mockInsert = vi.fn();
  const mockValues = vi.fn();

  // 鏈式操作支援
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockInsert.mockReturnValue({ values: mockValues });

  return {
    mockDb: {
      query: {
        teamSessions: { findFirst: vi.fn() },
        teamScoreHistory: { findMany: vi.fn() },
      },
      update: mockUpdate,
      insert: mockInsert,
      _chain: { set: mockSet, where: mockWhere, values: mockValues },
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1", displayName: "Test User" },
      };
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  }),
}));

// Mock schema（避免 Drizzle 直接存取 table 物件引發錯誤）
vi.mock("@shared/schema", () => ({
  teamSessions: { id: "teamSessions.id", teamId: "teamSessions.teamId" },
  teamScoreHistory: { teamId: "teamScoreHistory.teamId", createdAt: "teamScoreHistory.createdAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: string, b: string) => ({ op: "eq", a, b })),
  desc: vi.fn((col: string) => ({ op: "desc", col })),
}));

import { registerTeamScoreRoutes } from "../routes/team-scores";

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = {
    broadcastToSession: vi.fn(),
    broadcastToTeam: vi.fn(),
  };
  registerTeamScoreRoutes(app, ctx);
  return { app, ctx };
}

describe("Team Scores 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設鏈式 mock
    mockDb.update.mockReturnValue({ set: mockDb._chain.set });
    mockDb._chain.set.mockReturnValue({ where: mockDb._chain.where });
    mockDb.insert.mockReturnValue({ values: mockDb._chain.values });
  });

  describe("POST /api/teams/:teamId/score", () => {
    it("未認證應回 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/score")
        .send({ delta: 10 });
      expect(res.status).toBe(401);
    });

    it("隊伍不存在應回 404", async () => {
      const { app } = createApp();
      mockDb.query.teamSessions.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({ delta: 10 });

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("不存在");
    });

    it("缺少 delta 應回 400 驗證錯誤", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("驗證失敗");
    });

    it("delta 非數字應回 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({ delta: "abc" });

      expect(res.status).toBe(400);
    });

    it("正常加分應更新分數並回傳結果", async () => {
      const { app, ctx } = createApp();
      mockDb.query.teamSessions.findFirst.mockResolvedValueOnce({
        id: "session-1",
        teamId: "team-1",
        teamScore: 50,
      });
      mockDb._chain.where.mockResolvedValueOnce(undefined);
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({ delta: 10, sourceType: "quiz", description: "答對問題" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        previousScore: 50,
        delta: 10,
        newScore: 60,
      });

      // 應更新 teamSessions
      expect(mockDb.update).toHaveBeenCalled();
      // 應插入 scoreHistory
      expect(mockDb.insert).toHaveBeenCalled();
      // 應廣播
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "score_update", delta: 10, newScore: 60 }),
      );
    });

    it("扣分場景（負 delta）應正確計算", async () => {
      const { app } = createApp();
      mockDb.query.teamSessions.findFirst.mockResolvedValueOnce({
        id: "session-1",
        teamId: "team-1",
        teamScore: 30,
      });
      mockDb._chain.where.mockResolvedValueOnce(undefined);
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({ delta: -15 });

      expect(res.status).toBe(200);
      expect(res.body.newScore).toBe(15);
      expect(res.body.previousScore).toBe(30);
    });

    it("teamScore 為 null 時預設從 0 起算", async () => {
      const { app } = createApp();
      mockDb.query.teamSessions.findFirst.mockResolvedValueOnce({
        id: "session-1",
        teamId: "team-1",
        teamScore: null,
      });
      mockDb._chain.where.mockResolvedValueOnce(undefined);
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({ delta: 25 });

      expect(res.status).toBe(200);
      expect(res.body.newScore).toBe(25);
      expect(res.body.previousScore).toBe(0);
    });

    it("帶可選欄位（sourceType, sourceId, description）應正確傳入", async () => {
      const { app } = createApp();
      mockDb.query.teamSessions.findFirst.mockResolvedValueOnce({
        id: "session-1",
        teamId: "team-1",
        teamScore: 100,
      });
      mockDb._chain.where.mockResolvedValueOnce(undefined);
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/score")
        .set("Authorization", "Bearer valid-token")
        .send({
          delta: 5,
          sourceType: "achievement",
          sourceId: "ach-1",
          description: "完成地標探索",
        });

      expect(res.status).toBe(200);
      expect(res.body.newScore).toBe(105);
    });
  });

  describe("GET /api/teams/:teamId/score-history", () => {
    it("未認證應回 401", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/teams/team-1/score-history");
      expect(res.status).toBe(401);
    });

    it("成功回傳分數紀錄", async () => {
      const { app } = createApp();
      const mockHistory = [
        { id: "1", teamId: "team-1", delta: 10, runningTotal: 10, sourceType: "quiz" },
        { id: "2", teamId: "team-1", delta: 5, runningTotal: 15, sourceType: "manual" },
      ];
      mockDb.query.teamScoreHistory.findMany.mockResolvedValueOnce(mockHistory);

      const res = await request(app)
        .get("/api/teams/team-1/score-history")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockHistory);
      expect(res.body).toHaveLength(2);
    });

    it("無紀錄時回傳空陣列", async () => {
      const { app } = createApp();
      mockDb.query.teamScoreHistory.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/teams/team-1/score-history")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("DB 錯誤應回 500", async () => {
      const { app } = createApp();
      mockDb.query.teamScoreHistory.findMany.mockRejectedValueOnce(
        new Error("DB connection failed"),
      );

      const res = await request(app)
        .get("/api/teams/team-1/score-history")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(500);
      expect(res.body.message).toContain("失敗");
    });
  });
});
