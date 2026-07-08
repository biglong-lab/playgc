// 🛟 rejoin / rejoinable-team / leader-decide 防呆 整合測試
//（CHITO #ec3f612b 退出重進無法連線 + #0e0f5f17 先繼續誤踢在線玩家）
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

const { mockDb } = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockSet = vi.fn();
  const mockWhere = vi.fn();
  mockUpdate.mockReturnValue({ set: mockSet });
  mockSet.mockReturnValue({ where: mockWhere });
  mockWhere.mockResolvedValue(undefined);

  return {
    mockDb: {
      query: {
        teams: { findFirst: vi.fn() },
        teamMembers: { findFirst: vi.fn(), findMany: vi.fn() },
        teamSessions: { findFirst: vi.fn() },
        teamVotes: { findMany: vi.fn() },
        users: { findFirst: vi.fn() },
      },
      update: mockUpdate,
      _chain: { set: mockSet, where: mockWhere },
    },
  };
});

vi.mock("../db", () => ({ db: mockDb }));
vi.mock("../storage", () => ({ storage: { createPlayerProgress: vi.fn() } }));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = { claims: { sub: "user-1" }, dbUser: { id: "user-1" } };
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  }),
}));

vi.mock("@shared/schema", () => ({
  teams: { id: "teams.id" },
  teamMembers: {
    id: "teamMembers.id",
    teamId: "teamMembers.teamId",
    userId: "teamMembers.userId",
    leftAt: "teamMembers.leftAt",
  },
  teamSessions: { teamId: "teamSessions.teamId", createdAt: "teamSessions.createdAt" },
  gameSessions: { id: "gameSessions.id" },
  users: { id: "users.id" },
  teamVotes: {},
  teamVoteBallots: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a: string, b: string) => ({ op: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ op: "and", args })),
  desc: vi.fn((col: string) => ({ op: "desc", col })),
  isNull: vi.fn((col: string) => ({ op: "isNull", col })),
  isNotNull: vi.fn((col: string) => ({ op: "isNotNull", col })),
  inArray: vi.fn((col: string, vals: unknown[]) => ({ op: "inArray", col, vals })),
}));

// reevaluateTeamVotes 走真模組但 db 已 mock（teamVotes.findMany 回空 → 直接 return）
import { registerTeamLifecycleRoutes } from "../routes/team-lifecycle";

function createApp(ctxOverrides: Record<string, unknown> = {}) {
  const app = express();
  app.use(express.json());
  const broadcastToTeam = vi.fn();
  const ctx = {
    broadcastToSession: vi.fn(),
    broadcastToTeam,
    broadcastToMatch: vi.fn(),
    broadcastToBattleSlot: vi.fn(),
    cancelDisconnectTimer: vi.fn(),
    kickUserFromTeam: vi.fn(),
    ...ctxOverrides,
  };
  registerTeamLifecycleRoutes(app, ctx as never);
  return { app, ctx, broadcastToTeam };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.query.teamVotes.findMany.mockResolvedValue([]);
});

describe("POST /api/teams/:teamId/leader-decide 「先繼續」防呆", () => {
  const leaderTeam = { id: "team-1", leaderId: "user-1", status: "playing" };

  it("目標玩家已重連 → 不設 leftAt、回 already_back", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue(leaderTeam);
    const isUserStillConnected = vi.fn().mockReturnValue(true);
    const { app, ctx, broadcastToTeam } = createApp({ isUserStillConnected });

    const res = await request(app)
      .post("/api/teams/team-1/leader-decide")
      .set("Authorization", "Bearer valid-token")
      .send({ targetUserId: "user-2", action: "continue" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("already_back");
    expect(isUserStillConnected).toHaveBeenCalledWith("team-1", "user-2");
    // 不應該執行 leftAt update
    expect(mockDb.update).not.toHaveBeenCalled();
    // 廣播 reconnected 通知全隊
    expect(broadcastToTeam).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "team_member_reconnected", userId: "user-2" }),
    );
    // 取消殘留計時器
    expect((ctx as any).cancelDisconnectTimer).toHaveBeenCalledWith("team-1", "user-2");
  });

  it("目標玩家確實離線 → 照舊設 leftAt + 廣播 left", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue(leaderTeam);
    mockDb.query.users.findFirst.mockResolvedValue({ id: "user-2", firstName: "小明" });
    const isUserStillConnected = vi.fn().mockReturnValue(false);
    const { app, broadcastToTeam } = createApp({ isUserStillConnected });

    const res = await request(app)
      .post("/api/teams/team-1/leader-decide")
      .set("Authorization", "Bearer valid-token")
      .send({ targetUserId: "user-2", action: "continue" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("continue");
    expect(mockDb.update).toHaveBeenCalled();
    expect(broadcastToTeam).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "team_member_left", userId: "user-2" }),
    );
  });

  it("action=wait 不受防呆影響（照舊廣播等待）", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue(leaderTeam);
    const isUserStillConnected = vi.fn().mockReturnValue(true);
    const { app, broadcastToTeam } = createApp({ isUserStillConnected });

    const res = await request(app)
      .post("/api/teams/team-1/leader-decide")
      .set("Authorization", "Bearer valid-token")
      .send({ targetUserId: "user-2", action: "wait" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("wait");
    expect(broadcastToTeam).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "team_leader_decide", action: "wait" }),
    );
  });
});

describe("GET /api/games/:gameId/rejoinable-team", () => {
  it("有已離開且隊伍仍 playing 的紀錄 → 回隊伍摘要", async () => {
    mockDb.query.teamMembers.findMany.mockResolvedValue([
      {
        leftAt: new Date("2026-07-08T10:00:00Z"),
        team: {
          id: "team-1",
          gameId: "game-1",
          name: "衝鋒隊",
          status: "playing",
          members: [{ userId: "u2" }, { userId: "u3" }],
        },
      },
    ]);
    const { app } = createApp();

    const res = await request(app)
      .get("/api/games/game-1/rejoinable-team")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      teamId: "team-1",
      name: "衝鋒隊",
      status: "playing",
      memberCount: 2,
    });
  });

  it("隊伍已 disbanded → 回 null", async () => {
    mockDb.query.teamMembers.findMany.mockResolvedValue([
      {
        leftAt: new Date(),
        team: { id: "team-1", gameId: "game-1", name: "x", status: "disbanded", members: [] },
      },
    ]);
    const { app } = createApp();

    const res = await request(app)
      .get("/api/games/game-1/rejoinable-team")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toBeNull();
  });

  it("別的遊戲的隊伍不算", async () => {
    mockDb.query.teamMembers.findMany.mockResolvedValue([
      {
        leftAt: new Date(),
        team: { id: "team-9", gameId: "other-game", name: "x", status: "playing", members: [] },
      },
    ]);
    const { app } = createApp();

    const res = await request(app)
      .get("/api/games/game-1/rejoinable-team")
      .set("Authorization", "Bearer valid-token");

    expect(res.body).toBeNull();
  });
});

describe("POST /api/teams/:teamId/rejoin", () => {
  it("曾是成員（leftAt 有值）+ 隊伍 playing → 清 leftAt + 設 isReady + 廣播", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue({
      id: "team-1",
      status: "playing",
    });
    mockDb.query.teamMembers.findFirst.mockResolvedValue({
      id: "member-1",
      leftAt: new Date("2026-07-08T10:00:00Z"),
    });
    mockDb.query.users.findFirst.mockResolvedValue({ id: "user-1", firstName: "阿榮" });
    const { app, broadcastToTeam } = createApp();

    const res = await request(app)
      .post("/api/teams/team-1/rejoin")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.rejoined).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb._chain.set).toHaveBeenCalledWith({ leftAt: null, isReady: true });
    expect(broadcastToTeam).toHaveBeenCalledWith(
      "team-1",
      expect.objectContaining({ type: "team_member_reconnected", userId: "user-1" }),
    );
  });

  it("現任成員（leftAt 為 null）→ 冪等回成功、不 update", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue({ id: "team-1", status: "playing" });
    mockDb.query.teamMembers.findFirst.mockResolvedValue({ id: "member-1", leftAt: null });
    const { app } = createApp();

    const res = await request(app)
      .post("/api/teams/team-1/rejoin")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.rejoined).toBe(false);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("不曾是成員 → 403", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue({ id: "team-1", status: "playing" });
    mockDb.query.teamMembers.findFirst.mockResolvedValue(undefined);
    const { app } = createApp();

    const res = await request(app)
      .post("/api/teams/team-1/rejoin")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(403);
  });

  it("隊伍已 completed → 400", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue({ id: "team-1", status: "completed" });
    const { app } = createApp();

    const res = await request(app)
      .post("/api/teams/team-1/rejoin")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(400);
  });

  it("隊伍不存在 → 404", async () => {
    mockDb.query.teams.findFirst.mockResolvedValue(undefined);
    const { app } = createApp();

    const res = await request(app)
      .post("/api/teams/team-1/rejoin")
      .set("Authorization", "Bearer valid-token")
      .send({});

    expect(res.status).toBe(404);
  });
});
