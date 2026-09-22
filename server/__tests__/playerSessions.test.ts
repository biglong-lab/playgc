import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage（vi.hoisted 確保 hoisted vi.mock 可存取）
const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    getActiveSessionByUserAndGame: vi.fn(),
    getSessionsByUser: vi.fn(),
    createSession: vi.fn(),
    getSession: vi.fn(),
    updateSession: vi.fn(),
    createLeaderboardEntry: vi.fn(),
    getPlayerProgress: vi.fn(),
    getPlayerProgressByUser: vi.fn(), // PATCH /api/sessions/:id/progress 用
    createPlayerProgress: vi.fn(),
    updatePlayerProgress: vi.fn(),
    getUser: vi.fn(),
    upsertUser: vi.fn(),
    getChatMessages: vi.fn(),
    createChatMessage: vi.fn(),
    getGame: vi.fn(),    // POST /api/sessions location_lock 用
    getItems: vi.fn(),   // PATCH progress inventory validation 用
    // 🆕 2026-07-08 CHITO #f095652b：建新 session 時放棄舊 solo playing
    abandonOtherPlayingSessionsForUser: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock("../storage", () => ({
  storage: mockStorage,
}));

// 🔐 2026-09-22：場次參賽者檢查（預設是參賽者；個別測試改為 false 驗 403）
const { mockIsParticipant } = vi.hoisted(() => ({ mockIsParticipant: vi.fn() }));
vi.mock("../services/session-access", () => ({
  isSessionParticipant: (...a: unknown[]) => mockIsParticipant(...a),
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1", displayName: "Test User", email: "test@test.com" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
}));

// Mock ObjectStorageService（略過 photo/object 端點的複雜 mock）
vi.mock("../objectStorage", () => ({
  ObjectStorageService: vi.fn(() => ({
    searchPublicObject: vi.fn(),
    downloadObject: vi.fn(),
    getObjectEntityFile: vi.fn(),
    canAccessObjectEntity: vi.fn(),
    getObjectEntityUploadURL: vi.fn(),
    trySetObjectEntityAclPolicy: vi.fn(),
    normalizeObjectEntityPath: vi.fn(),
  })),
  ObjectNotFoundError: class ObjectNotFoundError extends Error {},
}));

vi.mock("../objectAcl", () => ({
  ObjectPermission: { READ: "read", WRITE: "write" },
}));

// Mock rate limiters（測試環境不需限流）
vi.mock("../utils/rate-limiters", () => ({
  hotPathLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
  chatLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
  // 🔐 2026-07-09 S3
  sessionCreateLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
  sessionCreateIpLimiter: vi.fn((_req: any, _res: any, next: any) => next()),
}));

// Mock 動態 import 的 services
vi.mock("../services/field-memberships", () => ({
  ensureMembership: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../services/achievement-unlock", () => ({
  checkAndUnlockAchievements: vi.fn().mockResolvedValue([]),
}));

// 🔒 2026-09-23 安全審查 H1：完成場次一律跑分數驗證
const { mockValidateScore } = vi.hoisted(() => ({ mockValidateScore: vi.fn() }));
vi.mock("../lib/scoreValidation", () => ({
  validateSessionScore: mockValidateScore,
  MAX_SESSION_SCORE: 10000,
}));

// 🏁 2026-09-23 競賽 / 接力掛勾（預設不是賽事場次；個別測試調整）
const { mockMatchHooks } = vi.hoisted(() => ({
  mockMatchHooks: {
    linkSessionToMatch: vi.fn(),
    syncMatchScore: vi.fn(),
    isRelayLeg: vi.fn(),
    completeMatchForSession: vi.fn(),
  },
}));
vi.mock("../services/match-session-hooks", () => mockMatchHooks);

import { registerPlayerSessionRoutes } from "../routes/player-sessions";

function createApp() {
  const app = express();
  app.use(express.json());
  registerPlayerSessionRoutes(app);
  return app;
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("Player Sessions 路由", () => {
  let app: ReturnType<typeof express>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsParticipant.mockResolvedValue(true);
    mockMatchHooks.linkSessionToMatch.mockResolvedValue(false);
    mockMatchHooks.isRelayLeg.mockResolvedValue(false);
    mockMatchHooks.completeMatchForSession.mockResolvedValue(undefined);
    mockValidateScore.mockImplementation(async ({ clientScore }: { clientScore: number }) => ({
      safeScore: Math.min(clientScore, 500), // 測試用：把超過 500 的分數修正掉
      adjusted: clientScore > 500,
      clientScore,
    }));
    app = createApp();
  });

  // =====================================================
  // GET /api/sessions/active
  // =====================================================
  describe("GET /api/sessions/active", () => {
    it("應回傳使用者的活躍場次", async () => {
      mockStorage.getActiveSessionByUserAndGame.mockResolvedValue({
        session: { id: "s-1", gameId: "g-1", status: "active" },
        progress: { currentPageId: "p-1", score: 100, inventory: [], variables: {} },
      });

      const res = await request(app)
        .get("/api/sessions/active?gameId=g-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.session.id).toBe("s-1");
      expect(res.body.progress.score).toBe(100);
    });

    it("缺少 gameId 應回傳 400", async () => {
      const res = await request(app)
        .get("/api/sessions/active")
        .set(AUTH_HEADER);

      expect(res.status).toBe(400);
    });

    it("無活躍場次應回傳 null", async () => {
      mockStorage.getActiveSessionByUserAndGame.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/sessions/active?gameId=g-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("未認證應回傳 401", async () => {
      const res = await request(app).get("/api/sessions/active?gameId=g-1");
      expect(res.status).toBe(401);
    });
  });

  // =====================================================
  // GET /api/sessions
  // =====================================================
  describe("GET /api/sessions", () => {
    it("應回傳使用者所有場次（含進度）", async () => {
      mockStorage.getSessionsByUser.mockResolvedValue([
        {
          session: { id: "s-1", gameId: "g-1" },
          progress: { currentPageId: "p-2", score: 50, inventory: ["item-1"], variables: { key: "val" } },
        },
      ]);

      const res = await request(app)
        .get("/api/sessions")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].playerScore).toBe(50);
      expect(res.body[0].inventory).toEqual(["item-1"]);
    });
  });

  // =====================================================
  // POST /api/sessions
  // =====================================================
  describe("POST /api/sessions", () => {
    it("應建立新場次並初始化進度", async () => {
      const sessionData = { gameId: "g-1", status: "active" };
      mockStorage.createSession.mockResolvedValue({ id: "s-new", ...sessionData });
      mockStorage.getUser.mockResolvedValue({ id: "user-1" });
      mockStorage.createPlayerProgress.mockResolvedValue({ id: 1 });

      const res = await request(app)
        .post("/api/sessions")
        .set(AUTH_HEADER)
        .send(sessionData);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("s-new");
      expect(mockStorage.createPlayerProgress).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "s-new", userId: "user-1" })
      );
      // 🆕 2026-07-08 CHITO #f095652b：建新場次必須放棄同玩家同遊戲的舊 solo playing
      expect(mockStorage.abandonOtherPlayingSessionsForUser).toHaveBeenCalledWith(
        "user-1", "g-1", "s-new",
      );
    });

    it("新使用者應自動建立 user 記錄", async () => {
      mockStorage.createSession.mockResolvedValue({ id: "s-new", gameId: "g-1" });
      mockStorage.getUser.mockResolvedValue(null);
      mockStorage.upsertUser.mockResolvedValue({ id: "user-1" });
      mockStorage.createPlayerProgress.mockResolvedValue({ id: 1 });

      await request(app)
        .post("/api/sessions")
        .set(AUTH_HEADER)
        .send({ gameId: "g-1", status: "active" });

      expect(mockStorage.upsertUser).toHaveBeenCalledWith(
        expect.objectContaining({ id: "user-1" })
      );
    });
  });

  // =====================================================
  // GET /api/sessions/:id
  // =====================================================
  describe("GET /api/sessions/:id", () => {
    it("應回傳指定場次", async () => {
      mockStorage.getSession.mockResolvedValue({ id: "s-1", gameId: "g-1", status: "active" });

      const res = await request(app)
        .get("/api/sessions/s-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe("s-1");
    });

    it("場次不存在應回傳 404", async () => {
      mockStorage.getSession.mockResolvedValue(null);

      const res = await request(app)
        .get("/api/sessions/not-exist")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
    });
  });

  // =====================================================
  // PATCH /api/sessions/:id
  // =====================================================
  describe("PATCH /api/sessions/:id", () => {
    it("應更新場次資料", async () => {
      mockStorage.updateSession.mockResolvedValue({ id: "s-1", status: "paused" });

      const res = await request(app)
        .patch("/api/sessions/s-1")
        .set(AUTH_HEADER)
        .send({ status: "paused" });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("paused");
    });

    it("🔐 非本場參賽者 → 403，不更新場次", async () => {
      mockIsParticipant.mockResolvedValueOnce(false);
      const res = await request(app)
        .patch("/api/sessions/s-other")
        .set(AUTH_HEADER)
        .send({ status: "completed", score: 999 });
      expect(res.status).toBe(403);
      expect(mockStorage.updateSession).not.toHaveBeenCalled();
      expect(mockIsParticipant).toHaveBeenCalledWith("s-other", "user-1");
    });

    it("完成場次應建立排行榜記錄", async () => {
      mockStorage.updateSession.mockResolvedValue({
        id: "s-1",
        gameId: "g-1",
        status: "completed",
        score: 500,
        teamName: "TeamA",
        startedAt: "2026-02-16T10:00:00Z",
        completedAt: "2026-02-16T11:00:00Z",
      });
      mockStorage.createLeaderboardEntry.mockResolvedValue({});

      const res = await request(app)
        .patch("/api/sessions/s-1")
        .set(AUTH_HEADER)
        .send({ status: "completed" });

      expect(res.status).toBe(200);
      expect(mockStorage.createLeaderboardEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          gameId: "g-1",
          sessionId: "s-1",
          totalScore: 500,
        })
      );
    });

    it("場次不存在應回傳 404", async () => {
      mockStorage.updateSession.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/sessions/not-exist")
        .set(AUTH_HEADER)
        .send({ status: "paused" });

      expect(res.status).toBe(404);
    });
  });

  // =====================================================
  // PATCH /api/sessions/:id/progress
  // =====================================================
  describe("PATCH /api/sessions/:id/progress", () => {
    it("應更新現有進度", async () => {
      // 路由改用 getPlayerProgressByUser（複合 index 優化）
      mockStorage.getPlayerProgressByUser.mockResolvedValue({
        id: 1, sessionId: "s-1", userId: "user-1", currentPageId: "p-1",
      });
      mockStorage.updatePlayerProgress.mockResolvedValue({
        id: 1, userId: "user-1", currentPageId: "p-2", score: 200,
      });

      const res = await request(app)
        .patch("/api/sessions/s-1/progress")
        .set(AUTH_HEADER)
        .send({ pageId: "p-2", score: 200 });

      expect(res.status).toBe(200);
      expect(mockStorage.updatePlayerProgress).toHaveBeenCalledWith(1, {
        currentPageId: "p-2",
        score: 200,
      });
    });

    it("無現有進度應自動建立", async () => {
      // 路由先 getPlayerProgressByUser → 沒有 → 查 session 確認存在 → createPlayerProgress
      mockStorage.getPlayerProgressByUser.mockResolvedValue(undefined);
      mockStorage.getSession.mockResolvedValue({ id: "s-1", gameId: "g-1" });
      mockStorage.getItems.mockResolvedValue([{ id: "sword" }]); // inventory 驗證
      mockStorage.createPlayerProgress.mockResolvedValue({
        id: 2, userId: "user-1", score: 0,
      });

      const res = await request(app)
        .patch("/api/sessions/s-1/progress")
        .set(AUTH_HEADER)
        .send({ score: 0, inventory: ["sword"] });

      expect(res.status).toBe(200);
      expect(mockStorage.createPlayerProgress).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: "s-1", userId: "user-1", inventory: ["sword"] })
      );
    });

    it("場次不存在應回傳 404", async () => {
      // 路由：getPlayerProgressByUser → 無 → 查 session → 不存在 → 404
      mockStorage.getPlayerProgressByUser.mockResolvedValue(undefined);
      mockStorage.getSession.mockResolvedValue(null);

      const res = await request(app)
        .patch("/api/sessions/s-1/progress")
        .set(AUTH_HEADER)
        .send({ score: 100 });

      expect(res.status).toBe(404);
    });
  });

  // =====================================================
  // Chat API
  // =====================================================
  describe("GET /api/chat/:sessionId", () => {
    it("應回傳聊天訊息列表", async () => {
      mockStorage.getChatMessages.mockResolvedValue([
        { id: 1, sessionId: "s-1", message: "Hello" },
      ]);

      const res = await request(app)
        .get("/api/chat/s-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });
  });

  describe("POST /api/chat/:sessionId", () => {
    it("應建立新聊天訊息", async () => {
      mockStorage.createChatMessage.mockResolvedValue({
        id: 1, sessionId: "s-1", userId: "user-1", message: "Hi team!",
      });

      const res = await request(app)
        .post("/api/chat/s-1")
        .set(AUTH_HEADER)
        .send({ message: "Hi team!" });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe("Hi team!");
    });
  });

  // =====================================================
  // 🏁 2026-09-23 競賽 / 接力掛勾
  // =====================================================
  describe("賽事掛勾", () => {
    const MATCH_ID = "11111111-1111-4111-8111-111111111111";

    it("開局帶 matchId → 綁定到賽事，回應 matchLinked", async () => {
      mockStorage.createSession.mockResolvedValue({ id: "s-m", gameId: "g-1" });
      mockStorage.getUser.mockResolvedValue({ id: "user-1" });
      mockStorage.createPlayerProgress.mockResolvedValue({ id: 1 });
      mockMatchHooks.linkSessionToMatch.mockResolvedValue(true);
      const res = await request(app).post("/api/sessions").set(AUTH_HEADER).send({ gameId: "g-1", matchId: MATCH_ID });
      expect(res.status).toBe(201);
      expect(res.body.matchLinked).toBe(true);
      expect(mockMatchHooks.linkSessionToMatch).toHaveBeenCalledWith(MATCH_ID, "user-1", "s-m");
    });

    it("沒帶 matchId → 不查賽事", async () => {
      mockStorage.createSession.mockResolvedValue({ id: "s-n", gameId: "g-1" });
      mockStorage.getUser.mockResolvedValue({ id: "user-1" });
      mockStorage.createPlayerProgress.mockResolvedValue({ id: 1 });
      const res = await request(app).post("/api/sessions").set(AUTH_HEADER).send({ gameId: "g-1" });
      expect(res.body.matchLinked).toBe(false);
      expect(mockMatchHooks.linkSessionToMatch).not.toHaveBeenCalled();
    });

    it("進度帶分數 → 同步賽事分數", async () => {
      mockStorage.getPlayerProgressByUser.mockResolvedValue({ id: 1, sessionId: "s-1", userId: "user-1" });
      mockStorage.updatePlayerProgress.mockResolvedValue({ id: 1, score: 120 });
      await request(app).patch("/api/sessions/s-1/progress").set(AUTH_HEADER).send({ pageId: "p-2", score: 120 });
      // 🔒 安全審查 M5：接力要靠 pageId 確認是自己那一段的頁面
      expect(mockMatchHooks.syncMatchScore).toHaveBeenCalledWith("s-1", "user-1", 120, undefined, "p-2");
    });

    it("接力的一棒完成 → 不寫個人排行榜，但交給賽事處理交棒", async () => {
      mockMatchHooks.isRelayLeg.mockResolvedValue(true);
      mockStorage.updateSession.mockResolvedValue({ id: "s-1", gameId: "g-1", status: "completed", score: 30 });
      const res = await request(app).patch("/api/sessions/s-1").set(AUTH_HEADER).send({ status: "completed" });
      expect(res.status).toBe(200);
      expect(mockStorage.createLeaderboardEntry).not.toHaveBeenCalled();
      expect(mockMatchHooks.completeMatchForSession).toHaveBeenCalledWith("s-1", "user-1", 30, undefined);
    });
  });

  // =====================================================
  // 🔒 2026-09-23 安全審查修正
  // =====================================================
  describe("分數偽造防線", () => {
    it("建立場次不接受 client 自帶 score / status（白名單以外欄位被丟掉）", async () => {
      mockStorage.createSession.mockResolvedValue({ id: "s-x", gameId: "g-1" });
      mockStorage.getUser.mockResolvedValue({ id: "user-1" });
      mockStorage.createPlayerProgress.mockResolvedValue({ id: 1 });
      await request(app).post("/api/sessions").set(AUTH_HEADER)
        .send({ gameId: "g-1", score: 9999, status: "completed", hostMode: true });
      const created = mockStorage.createSession.mock.calls[0][0];
      expect(created).not.toHaveProperty("score");
      expect(created).not.toHaveProperty("status");
      expect(created).not.toHaveProperty("hostMode");
    });

    it("完成場次沒帶 score → 仍用 DB 現值跑驗證並寫回安全分數", async () => {
      mockStorage.getSession.mockResolvedValue({ id: "s-1", gameId: "g-1", score: 9999, status: "playing" });
      mockStorage.updateSession.mockResolvedValue({ id: "s-1", gameId: "g-1", status: "completed", score: 500 });
      const res = await request(app).patch("/api/sessions/s-1").set(AUTH_HEADER).send({ status: "completed" });
      expect(res.status).toBe(200);
      expect(mockValidateScore).toHaveBeenCalledWith(expect.objectContaining({ clientScore: 9999, source: "session-complete" }));
      expect(mockStorage.updateSession).toHaveBeenCalledWith("s-1", expect.objectContaining({ score: 500 }));
    });
  });
});
