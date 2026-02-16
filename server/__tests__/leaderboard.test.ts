import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage 模組
vi.mock("../storage", () => ({
  storage: {
    getLeaderboard: vi.fn(),
    getGames: vi.fn(),
    getSessions: vi.fn(),
    getUser: vi.fn(),
  },
}));

// Mock Firebase 認證
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    // 預設放行，個別測試可覆寫
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "admin-user-1" },
        dbUser: { id: "admin-user-1", role: "admin" },
      };
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  }),
  verifyFirebaseToken: vi.fn(),
}));

// Mock adminAuth 中間件
vi.mock("../adminAuth", () => ({
  adminAuthMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  requireAdminAuth: vi.fn((_req: any, _res: any, next: any) => next()),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  logAuditAction: vi.fn(),
  verifyToken: vi.fn(),
  getAdminPermissions: vi.fn(),
}));

import { storage } from "../storage";
import { registerLeaderboardRoutes } from "../routes/leaderboard";

const mockStorage = storage as {
  getLeaderboard: ReturnType<typeof vi.fn>;
  getGames: ReturnType<typeof vi.fn>;
  getSessions: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerLeaderboardRoutes(app);
  return app;
}

describe("排行榜路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/leaderboard", () => {
    it("回傳排行榜資料", async () => {
      const mockEntries = [
        { id: "1", playerName: "玩家A", score: 100 },
        { id: "2", playerName: "玩家B", score: 80 },
      ];
      mockStorage.getLeaderboard.mockResolvedValue(mockEntries);

      const app = createTestApp();
      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockEntries);
      expect(mockStorage.getLeaderboard).toHaveBeenCalledWith(undefined);
    });

    it("帶 gameId 查詢參數篩選", async () => {
      mockStorage.getLeaderboard.mockResolvedValue([]);

      const app = createTestApp();
      const gameId = "a0000000-0000-4000-8000-000000000001";
      const res = await request(app)
        .get("/api/leaderboard")
        .query({ gameId });

      expect(res.status).toBe(200);
      expect(mockStorage.getLeaderboard).toHaveBeenCalledWith(gameId);
    });

    it("無效 gameId 格式回傳 400", async () => {
      const app = createTestApp();
      const res = await request(app)
        .get("/api/leaderboard")
        .query({ gameId: "invalid-id" });

      expect(res.status).toBe(400);
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getLeaderboard.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to fetch leaderboard");
    });
  });

  describe("GET /api/analytics/overview", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/analytics/overview");

      expect(res.status).toBe(401);
    });

    it("已認證 admin 回傳分析總覽", async () => {
      mockStorage.getUser.mockResolvedValue({ id: "admin-user-1", role: "admin" });
      mockStorage.getGames.mockResolvedValue([
        { id: "g1", title: "遊戲A", status: "published" },
        { id: "g2", title: "遊戲B", status: "draft" },
      ]);
      mockStorage.getSessions.mockResolvedValue([
        { id: "s1", gameId: "g1", status: "completed", startedAt: new Date().toISOString(), completedAt: new Date().toISOString() },
        { id: "s2", gameId: "g1", status: "playing", startedAt: new Date().toISOString() },
      ]);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/analytics/overview")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("totalGames", 2);
      expect(res.body).toHaveProperty("publishedGames", 1);
      expect(res.body).toHaveProperty("totalSessions", 2);
      expect(res.body).toHaveProperty("completedSessions", 1);
      expect(res.body).toHaveProperty("activeSessions", 1);
      expect(res.body).toHaveProperty("gameStats");
      expect(res.body.gameStats).toHaveLength(2);
    });

    it("非 admin 回傳 403", async () => {
      mockStorage.getUser.mockResolvedValue({ id: "admin-user-1", role: "player" });

      const app = createTestApp();
      const res = await request(app)
        .get("/api/analytics/overview")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(403);
    });
  });
});
