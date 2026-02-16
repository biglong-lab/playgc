import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock DB（teams.ts 大量直接使用 db.query）
const mockFindFirst = vi.fn();
const mockInsertReturning = vi.fn();
const mockUpdateSet = vi.fn();

vi.mock("../db", () => ({
  db: {
    query: {
      teams: { findFirst: vi.fn() },
      teamMembers: { findFirst: vi.fn() },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: mockInsertReturning,
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: mockUpdateSet,
      })),
    })),
  },
}));

vi.mock("../storage", () => ({
  storage: {
    getGame: vi.fn(),
    createPlayerProgress: vi.fn(),
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

// Mock 子模組路由
vi.mock("../routes/team-votes", () => ({
  registerTeamVoteRoutes: vi.fn(),
}));
vi.mock("../routes/team-scores", () => ({
  registerTeamScoreRoutes: vi.fn(),
}));

import { db } from "../db";
import { storage } from "../storage";
import { registerTeamRoutes } from "../routes/teams";

const mockStorage = storage as {
  getGame: ReturnType<typeof vi.fn>;
  createPlayerProgress: ReturnType<typeof vi.fn>;
};

const mockDb = db as any;

function createApp() {
  const app = express();
  app.use(express.json());
  const ctx = {
    broadcastToSession: vi.fn(),
  };
  registerTeamRoutes(app, ctx as any);
  return { app, ctx };
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("隊伍路由 (teams)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================
  // POST /api/games/:gameId/teams - 建立隊伍
  // ===========================================
  describe("POST /api/games/:gameId/teams", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/games/game-1/teams")
        .send({});
      expect(res.status).toBe(401);
    });

    it("遊戲不存在時回傳 404", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/games/game-1/teams")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("遊戲不存在");
    });

    it("非團隊模式時回傳 400", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue({
        id: "game-1",
        gameMode: "individual",
      });

      const res = await request(app)
        .post("/api/games/game-1/teams")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此遊戲不支援團隊模式");
    });

    it("已在隊伍中時回傳 400", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue({
        id: "game-1",
        gameMode: "team",
      });

      // 模擬已有 active 隊伍成員身份
      mockDb.query.teamMembers.findFirst.mockResolvedValue({
        teamId: "team-existing",
        team: { gameId: "game-1", status: "forming" },
      });

      const res = await request(app)
        .post("/api/games/game-1/teams")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("您已在此遊戲的隊伍中");
    });

    it("成功建立隊伍回傳 201", async () => {
      const { app } = createApp();
      mockStorage.getGame.mockResolvedValue({
        id: "game-1",
        gameMode: "team",
        minTeamPlayers: 2,
        maxTeamPlayers: 4,
      });

      // 沒有現有成員身份
      mockDb.query.teamMembers.findFirst.mockResolvedValue(null);
      // accessCode 不重複
      mockDb.query.teams.findFirst
        .mockResolvedValueOnce(null) // accessCode 查詢
        .mockResolvedValueOnce({
          // fullTeam 查詢
          id: "team-new",
          name: "隊伍 ABC123",
          accessCode: "ABC123",
          status: "forming",
          members: [{ userId: "user-1", role: "leader" }],
          game: { id: "game-1" },
          leader: { id: "user-1" },
        });

      mockInsertReturning.mockResolvedValueOnce([
        { id: "team-new", name: "隊伍 ABC123", accessCode: "ABC123" },
      ]);

      const res = await request(app)
        .post("/api/games/game-1/teams")
        .set(AUTH_HEADER)
        .send({ name: "我的隊伍" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("team-new");
    });
  });

  // ===========================================
  // POST /api/teams/join - 加入隊伍
  // ===========================================
  describe("POST /api/teams/join", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/join")
        .send({ accessCode: "ABC123" });
      expect(res.status).toBe(401);
    });

    it("缺少 accessCode 時回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("資料驗證失敗");
    });

    it("找不到隊伍時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "NONEXIST" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("找不到此組隊碼對應的隊伍");
    });

    it("隊伍已結束時回傳 400", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        status: "completed",
        members: [],
      });

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "ABC123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此隊伍已結束或已解散");
    });

    it("隊伍正在遊戲中時回傳 400", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        status: "playing",
        members: [],
      });

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "ABC123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此隊伍正在遊戲中，無法加入");
    });

    it("已在隊伍中時回傳 400", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        status: "forming",
        maxPlayers: 4,
        members: [{ userId: "user-1" }],
      });

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "ABC123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("您已經在此隊伍中");
    });

    it("隊伍已滿員時回傳 400", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        status: "forming",
        maxPlayers: 2,
        members: [{ userId: "user-2" }, { userId: "user-3" }],
      });

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "ABC123" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("隊伍已滿員");
    });

    it("成功加入隊伍", async () => {
      const { app, ctx } = createApp();
      // 第一次查 findFirst：找隊伍
      mockDb.query.teams.findFirst
        .mockResolvedValueOnce({
          id: "team-1",
          status: "forming",
          maxPlayers: 4,
          members: [{ userId: "user-2" }],
          game: { id: "game-1" },
        })
        // 第二次查 findFirst：更新後的隊伍
        .mockResolvedValueOnce({
          id: "team-1",
          status: "forming",
          members: [{ userId: "user-2" }, { userId: "user-1" }],
          game: { id: "game-1" },
          leader: { id: "user-2" },
        });

      const res = await request(app)
        .post("/api/teams/join")
        .set(AUTH_HEADER)
        .send({ accessCode: "ABC123" });

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(2);
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "member_joined" }),
      );
    });
  });

  // ===========================================
  // GET /api/teams/:teamId - 取得隊伍資料
  // ===========================================
  describe("GET /api/teams/:teamId", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/teams/team-1");
      expect(res.status).toBe(401);
    });

    it("隊伍不存在時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/teams/team-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("隊伍不存在");
    });

    it("成功取得隊伍資料", async () => {
      const { app } = createApp();
      const mockTeam = {
        id: "team-1",
        name: "測試隊伍",
        status: "forming",
        members: [{ userId: "user-1", role: "leader" }],
        game: { id: "game-1" },
        leader: { id: "user-1" },
      };
      mockDb.query.teams.findFirst.mockResolvedValue(mockTeam);

      const res = await request(app)
        .get("/api/teams/team-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("測試隊伍");
    });
  });

  // ===========================================
  // PATCH /api/teams/:teamId/ready - 更新準備狀態
  // ===========================================
  describe("PATCH /api/teams/:teamId/ready", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app)
        .patch("/api/teams/team-1/ready")
        .send({ isReady: true });
      expect(res.status).toBe(401);
    });

    it("缺少 isReady 欄位時回傳 400", async () => {
      const { app } = createApp();
      const res = await request(app)
        .patch("/api/teams/team-1/ready")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("資料驗證失敗");
    });

    it("不在隊伍中時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teamMembers.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/teams/team-1/ready")
        .set(AUTH_HEADER)
        .send({ isReady: true });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("您不在此隊伍中");
    });

    it("成功更新準備狀態", async () => {
      const { app, ctx } = createApp();
      mockDb.query.teamMembers.findFirst.mockResolvedValue({
        id: "member-1",
        userId: "user-1",
        teamId: "team-1",
        isReady: false,
      });
      mockUpdateSet.mockResolvedValue(undefined);

      // 第一次 teams.findFirst：檢查全員準備狀態
      mockDb.query.teams.findFirst
        .mockResolvedValueOnce({
          id: "team-1",
          status: "forming",
          minPlayers: 2,
          members: [
            { id: "member-1", userId: "user-1", isReady: false },
            { id: "member-2", userId: "user-2", isReady: true },
          ],
        })
        // 第二次：更新後的完整隊伍
        .mockResolvedValueOnce({
          id: "team-1",
          status: "forming",
          members: [
            { userId: "user-1", isReady: true },
            { userId: "user-2", isReady: true },
          ],
          game: { id: "game-1" },
          leader: { id: "user-1" },
        });

      const res = await request(app)
        .patch("/api/teams/team-1/ready")
        .set(AUTH_HEADER)
        .send({ isReady: true });

      expect(res.status).toBe(200);
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "ready_status_changed" }),
      );
    });
  });

  // ===========================================
  // POST /api/teams/:teamId/leave - 離開隊伍
  // ===========================================
  describe("POST /api/teams/:teamId/leave", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app).post("/api/teams/team-1/leave");
      expect(res.status).toBe(401);
    });

    it("隊伍不存在時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/teams/team-1/leave")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("隊伍不存在");
    });

    it("不在隊伍中時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        members: [{ userId: "user-other" }],
      });

      const res = await request(app)
        .post("/api/teams/team-1/leave")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("您不在此隊伍中");
    });

    it("成功離開隊伍", async () => {
      const { app, ctx } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        leaderId: "user-other",
        members: [
          { id: "member-1", userId: "user-1" },
          { id: "member-2", userId: "user-other" },
        ],
      });
      mockUpdateSet.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/leave")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("已離開隊伍");
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "member_left", userId: "user-1" }),
      );
    });

    it("隊長離開時只有自己則解散隊伍", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        leaderId: "user-1",
        members: [{ id: "member-1", userId: "user-1" }],
      });
      mockUpdateSet.mockResolvedValue(undefined);

      const res = await request(app)
        .post("/api/teams/team-1/leave")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
    });
  });

  // ===========================================
  // POST /api/teams/:teamId/start - 開始遊戲
  // ===========================================
  describe("POST /api/teams/:teamId/start", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app).post("/api/teams/team-1/start");
      expect(res.status).toBe(401);
    });

    it("隊伍不存在時回傳 404", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post("/api/teams/team-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("隊伍不存在");
    });

    it("非隊長時回傳 403", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        leaderId: "user-other",
        status: "ready",
        members: [],
      });

      const res = await request(app)
        .post("/api/teams/team-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("只有隊長可以開始遊戲");
    });

    it("隊伍未準備好且人數不足時回傳 400", async () => {
      const { app } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        leaderId: "user-1",
        status: "forming",
        minPlayers: 2,
        members: [{ userId: "user-1", isReady: true }],
        game: { id: "game-1" },
      });

      const res = await request(app)
        .post("/api/teams/team-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(400);
    });

    it("成功開始遊戲", async () => {
      const { app, ctx } = createApp();
      mockDb.query.teams.findFirst.mockResolvedValue({
        id: "team-1",
        leaderId: "user-1",
        gameId: "game-1",
        status: "ready",
        name: "測試隊伍",
        members: [
          { userId: "user-1", isReady: true },
          { userId: "user-2", isReady: true },
        ],
        game: { id: "game-1" },
      });

      mockInsertReturning.mockResolvedValueOnce([
        { id: "session-1" },
      ]);
      mockUpdateSet.mockResolvedValue(undefined);
      mockStorage.createPlayerProgress.mockResolvedValue({});

      const res = await request(app)
        .post("/api/teams/team-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.sessionId).toBe("session-1");
      expect(res.body.gameId).toBe("game-1");
      expect(ctx.broadcastToSession).toHaveBeenCalledWith(
        "team_team-1",
        expect.objectContaining({ type: "game_started" }),
      );
    });
  });

  // ===========================================
  // GET /api/games/:gameId/my-team - 取得我的隊伍
  // ===========================================
  describe("GET /api/games/:gameId/my-team", () => {
    it("未認證時回傳 401", async () => {
      const { app } = createApp();
      const res = await request(app).get("/api/games/game-1/my-team");
      expect(res.status).toBe(401);
    });

    it("沒有隊伍時回傳 null", async () => {
      const { app } = createApp();
      mockDb.query.teamMembers.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/games/game-1/my-team")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("隊伍已完成時回傳 null", async () => {
      const { app } = createApp();
      mockDb.query.teamMembers.findFirst.mockResolvedValue({
        team: { gameId: "game-1", status: "completed" },
      });

      const res = await request(app)
        .get("/api/games/game-1/my-team")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("成功取得我的隊伍", async () => {
      const { app } = createApp();
      const mockTeam = {
        id: "team-1",
        gameId: "game-1",
        status: "forming",
        name: "我的隊伍",
        members: [{ userId: "user-1" }],
      };
      mockDb.query.teamMembers.findFirst.mockResolvedValue({
        team: mockTeam,
      });

      const res = await request(app)
        .get("/api/games/game-1/my-team")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("我的隊伍");
    });
  });
});
