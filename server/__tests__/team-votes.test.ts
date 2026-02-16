import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock db（vi.hoisted 確保 hoisted vi.mock 可存取）
const { mockDb } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockValues = vi.fn();
  const mockReturning = vi.fn();
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();

  // 鏈式操作
  mockInsert.mockReturnValue({ values: mockValues });
  mockValues.mockReturnValue({ returning: mockReturning });
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });

  return {
    mockDb: {
      query: {
        teams: { findFirst: vi.fn() },
        teamVotes: { findFirst: vi.fn(), findMany: vi.fn() },
      },
      insert: mockInsert,
      update: mockUpdate,
      _chain: { values: mockValues, returning: mockReturning, set: mockSet, where: mockWhere },
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
    if (req.headers.authorization === "Bearer user-2-token") {
      req.user = {
        claims: { sub: "user-2" },
        dbUser: { id: "user-2", displayName: "User Two" },
      };
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  }),
}));

vi.mock("@shared/schema", () => ({
  teams: { id: "teams.id" },
  teamMembers: { leftAt: "teamMembers.leftAt", userId: "teamMembers.userId" },
  teamVotes: { id: "teamVotes.id", teamId: "teamVotes.teamId", status: "teamVotes.status", createdAt: "teamVotes.createdAt" },
  teamVoteBallots: { voteId: "teamVoteBallots.voteId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: string, b: string) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  desc: vi.fn((col: string) => ({ op: "desc", col })),
  isNull: vi.fn((col: string) => ({ op: "isNull", col })),
}));

import { registerTeamVoteRoutes } from "../routes/team-votes";

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = {
    broadcastToSession: vi.fn(),
    broadcastToTeam: vi.fn(),
  };
  registerTeamVoteRoutes(app, ctx);
  return { app, ctx };
}

// 共用測試資料
const mockTeamWithMembers = {
  id: "team-1",
  members: [
    { userId: "user-1", leftAt: null },
    { userId: "user-2", leftAt: null },
    { userId: "user-3", leftAt: null },
  ],
};

const validVoteBody = {
  title: "選擇路線",
  description: "決定下一步",
  options: [
    { label: "A 路線", targetPageId: "page-a" },
    { label: "B 路線", targetPageId: "page-b" },
  ],
  votingMode: "majority" as const,
};

describe("Team Votes 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設鏈式 mock
    mockDb.insert.mockReturnValue({ values: mockDb._chain.values });
    mockDb._chain.values.mockReturnValue({ returning: mockDb._chain.returning });
    mockDb.update.mockReturnValue({ set: mockDb._chain.set });
    mockDb._chain.set.mockReturnValue({ where: mockDb._chain.where });
  });

  describe("POST /api/teams/:teamId/votes - 建立投票", () => {
    it("未認證應回 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .send(validVoteBody);
      expect(res.status).toBe(401);
    });

    it("隊伍不存在應回 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send(validVoteBody);

      expect(res.status).toBe(404);
      expect(res.body.message).toContain("不存在");
    });

    it("非隊伍成員應回 403", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValueOnce({
        id: "team-1",
        members: [{ userId: "other-user", leftAt: null }],
      });

      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send(validVoteBody);

      expect(res.status).toBe(403);
    });

    it("選項不足 2 個應回 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send({
          title: "測試",
          options: [{ label: "只有一個" }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("驗證失敗");
    });

    it("缺少 title 應回 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send({
          options: [{ label: "A" }, { label: "B" }],
        });

      expect(res.status).toBe(400);
    });

    it("成功建立投票應回 201", async () => {
      const { app, ctx } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValueOnce(mockTeamWithMembers);
      const createdVote = {
        id: "vote-1",
        teamId: "team-1",
        title: "選擇路線",
        status: "active",
      };
      mockDb._chain.returning.mockResolvedValueOnce([createdVote]);

      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send(validVoteBody);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("vote-1");
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "vote_created" }),
      );
    });

    it("帶 expiresInSeconds 應正確設定過期時間", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValueOnce(mockTeamWithMembers);
      mockDb._chain.returning.mockResolvedValueOnce([{ id: "vote-2", teamId: "team-1" }]);

      const res = await request(app)
        .post("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token")
        .send({ ...validVoteBody, expiresInSeconds: 300 });

      expect(res.status).toBe(201);
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("POST /api/votes/:voteId/cast - 投票", () => {
    it("未認證應回 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .send({ optionId: "option_0" });
      expect(res.status).toBe(401);
    });

    it("投票不存在應回 404", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(404);
    });

    it("投票已結束應回 400", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        status: "completed",
        team: mockTeamWithMembers,
        ballots: [],
      });

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("已結束");
    });

    it("投票已過期應回 400", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        status: "active",
        expiresAt: new Date("2020-01-01").toISOString(),
        team: mockTeamWithMembers,
        ballots: [],
      });

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("過期");
    });

    it("非隊伍成員應回 403", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        status: "active",
        expiresAt: null,
        team: {
          id: "team-1",
          members: [{ userId: "other-user", leftAt: null }],
        },
        ballots: [],
      });

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(403);
    });

    it("重複投票應回 400", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        status: "active",
        expiresAt: null,
        votingMode: "majority",
        team: mockTeamWithMembers,
        ballots: [{ userId: "user-1", optionId: "option_0" }],
      });

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("已經投過票");
    });

    it("缺少 optionId 應回 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({});

      expect(res.status).toBe(400);
    });

    it("多數決 - 達到過半數應完成投票", async () => {
      const { app, ctx } = createApp();
      // 3 人隊伍，已有 1 票 option_0，user-1 再投 option_0 → 2/3 過半
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "majority",
        team: mockTeamWithMembers,
        ballots: [{ userId: "user-3", optionId: "option_0" }],
      });
      mockDb._chain.values.mockResolvedValueOnce(undefined);
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(true);
      expect(res.body.winningOptionId).toBe("option_0");
      // 應更新投票狀態為 completed
      expect(mockDb.update).toHaveBeenCalled();
      // 應廣播
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "vote_cast", isComplete: true }),
      );
    });

    it("多數決 - 未達過半數且仍有人未投", async () => {
      const { app } = createApp();
      // 3 人隊伍，目前沒人投，user-1 投 option_0 → 1/3 未過半
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "majority",
        team: mockTeamWithMembers,
        ballots: [],
      });
      // insert ballot
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(false);
      expect(res.body.winningOptionId).toBeNull();
      // 不應更新投票狀態
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("多數決 - 全部投完平票時選最多票的", async () => {
      const { app } = createApp();
      // 3 人隊伍：user-2 投 option_0，user-3 投 option_1，user-1 投 option_0
      // → option_0: 2 票，option_1: 1 票 → option_0 勝
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "majority",
        team: mockTeamWithMembers,
        ballots: [
          { userId: "user-2", optionId: "option_0" },
          { userId: "user-3", optionId: "option_1" },
        ],
      });
      mockDb._chain.values.mockResolvedValueOnce(undefined);
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(true);
      expect(res.body.winningOptionId).toBe("option_0");
    });

    it("全體一致模式 - 全部同意才完成", async () => {
      const { app } = createApp();
      // 3 人隊伍 unanimous：已有 2 人投 option_0，user-1 也投 option_0 → 完成
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "unanimous",
        team: mockTeamWithMembers,
        ballots: [
          { userId: "user-2", optionId: "option_0" },
          { userId: "user-3", optionId: "option_0" },
        ],
      });
      mockDb._chain.values.mockResolvedValueOnce(undefined);
      mockDb._chain.where.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(true);
      expect(res.body.winningOptionId).toBe("option_0");
    });

    it("全體一致模式 - 有不同意見則不完成", async () => {
      const { app } = createApp();
      // 3 人隊伍 unanimous：已有 2 人投不同選項，user-1 投任一 → 不 unanimous
      mockDb.query.teamVotes.findFirst.mockResolvedValueOnce({
        id: "vote-1",
        teamId: "team-1",
        status: "active",
        expiresAt: null,
        votingMode: "unanimous",
        team: mockTeamWithMembers,
        ballots: [
          { userId: "user-2", optionId: "option_0" },
          { userId: "user-3", optionId: "option_1" },
        ],
      });
      mockDb._chain.values.mockResolvedValueOnce(undefined);

      const res = await request(app)
        .post("/api/votes/vote-1/cast")
        .set("Authorization", "Bearer valid-token")
        .send({ optionId: "option_0" });

      expect(res.status).toBe(200);
      expect(res.body.isComplete).toBe(false);
    });
  });

  describe("GET /api/teams/:teamId/votes - 取得投票列表", () => {
    it("未認證應回 401", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/teams/team-1/votes");
      expect(res.status).toBe(401);
    });

    it("成功回傳投票列表", async () => {
      const { app } = createApp();
      const mockVotes = [
        { id: "vote-1", title: "選路線", status: "active", ballots: [] },
        { id: "vote-2", title: "選人", status: "active", ballots: [{ userId: "user-1" }] },
      ];
      mockDb.query.teamVotes.findMany.mockResolvedValueOnce(mockVotes);

      const res = await request(app)
        .get("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("無投票時回傳空陣列", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findMany.mockResolvedValueOnce([]);

      const res = await request(app)
        .get("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("DB 錯誤應回 500", async () => {
      const { app } = createApp();
      mockDb.query.teamVotes.findMany.mockRejectedValueOnce(new Error("DB error"));

      const res = await request(app)
        .get("/api/teams/team-1/votes")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(500);
      expect(res.body.message).toContain("失敗");
    });
  });
});
