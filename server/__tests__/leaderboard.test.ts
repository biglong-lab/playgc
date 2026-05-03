import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage 模組
// 注意：路由 /api/analytics/overview 用 getGamesByField / getSessionsByField
// （非 getGames / getSessions），因為已改 admin 場域隔離
vi.mock("../storage", () => ({
  storage: {
    getLeaderboard: vi.fn(),
    getGames: vi.fn(),
    getSessions: vi.fn(),
    getGamesByField: vi.fn(),
    getSessionsByField: vi.fn(),
    getUser: vi.fn(),
  },
}));

// Mock Firebase 認證（GET /api/leaderboard 不用、保留給未來測試）
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
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

// Mock adminAuth — 路由實際使用 requireAdminAuth（admin JWT）
// 必須注入 req.admin（含 fieldId）才能通過 handler 內 if (!req.admin) 檢查
vi.mock("../adminAuth", () => ({
  adminAuthMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  requireAdminAuth: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.admin = {
        id: "admin-1",
        username: "test-admin",
        systemRole: "super_admin",
        fieldId: "field-1",
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
  requirePermission: vi.fn(() => (_req: any, _res: any, next: any) => next()),
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
  getGamesByField: ReturnType<typeof vi.fn>;
  getSessionsByField: ReturnType<typeof vi.fn>;
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
      // 路由改用兩個參數 (gameId, fieldId) 支援場域過濾
      expect(mockStorage.getLeaderboard).toHaveBeenCalledWith(undefined, undefined);
    });

    it("帶 gameId 查詢參數篩選", async () => {
      mockStorage.getLeaderboard.mockResolvedValue([]);

      const app = createTestApp();
      const gameId = "a0000000-0000-4000-8000-000000000001";
      const res = await request(app)
        .get("/api/leaderboard")
        .query({ gameId });

      expect(res.status).toBe(200);
      expect(mockStorage.getLeaderboard).toHaveBeenCalledWith(gameId, undefined);
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
      mockStorage.getGamesByField.mockResolvedValue([
        { id: "g1", title: "遊戲A", status: "published" },
        { id: "g2", title: "遊戲B", status: "draft" },
      ]);
      mockStorage.getSessionsByField.mockResolvedValue([
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
      // 驗證有用 fieldId 過濾（admin 場域隔離）
      expect(mockStorage.getGamesByField).toHaveBeenCalledWith("field-1");
      expect(mockStorage.getSessionsByField).toHaveBeenCalledWith("field-1");
    });

    // 註：路由 W7 D1 後改用 admin JWT（requireAdminAuth）
    // role 角色判斷由 admin 登入流程把關（非此 endpoint 內 role check）
    // 因此「非 admin → 403」case 不再適用、改驗證「無 admin token → 401」
  });
});
