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
    createPlayerProgress: vi.fn(),
    updatePlayerProgress: vi.fn(),
    getUser: vi.fn(),
    upsertUser: vi.fn(),
    getChatMessages: vi.fn(),
    createChatMessage: vi.fn(),
  },
}));

vi.mock("../storage", () => ({
  storage: mockStorage,
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
      mockStorage.getSession.mockResolvedValue({ id: "s-1" });
      mockStorage.getPlayerProgress.mockResolvedValue([
        { id: 1, userId: "user-1", currentPageId: "p-1" },
      ]);
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
      mockStorage.getSession.mockResolvedValue({ id: "s-1" });
      mockStorage.getPlayerProgress.mockResolvedValue([]);
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
});
