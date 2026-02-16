import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock 所有外部依賴（避免 DB 連線）
vi.mock("../db", () => ({
  db: { query: { games: { findFirst: vi.fn() } }, update: vi.fn() },
}));

vi.mock("../storage", () => ({
  storage: {
    getPublishedGames: vi.fn(),
    getGameWithPages: vi.fn(),
    createGame: vi.fn(),
    updateGame: vi.fn(),
    deleteGame: vi.fn(),
    getPages: vi.fn(),
    getUser: vi.fn(),
    getGame: vi.fn(),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1" },
        dbUser: { id: "user-1", role: "creator" },
      };
      return next();
    }
    return res.status(401).json({ message: "Unauthorized" });
  }),
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../adminAuth", () => ({
  adminAuthMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
}));

vi.mock("../qrCodeService", () => ({
  generateGameQRCode: vi.fn().mockResolvedValue("data:image/png;base64,mock"),
  generateGameUrl: vi.fn().mockReturnValue("http://localhost/g/test123"),
  generateSlug: vi.fn().mockReturnValue("test1234"),
  getGameBySlug: vi.fn(),
}));

// Mock player-sessions 子模組
vi.mock("../routes/player-sessions", () => ({
  registerPlayerSessionRoutes: vi.fn(),
}));

import { storage } from "../storage";
import { registerPlayerGameRoutes } from "../routes/player-games";

const mockStorage = storage as {
  getPublishedGames: ReturnType<typeof vi.fn>;
  getGameWithPages: ReturnType<typeof vi.fn>;
  createGame: ReturnType<typeof vi.fn>;
  updateGame: ReturnType<typeof vi.fn>;
  deleteGame: ReturnType<typeof vi.fn>;
  getPages: ReturnType<typeof vi.fn>;
  getUser: ReturnType<typeof vi.fn>;
  getGame: ReturnType<typeof vi.fn>;
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerPlayerGameRoutes(app);
  return app;
}

describe("玩家遊戲路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/games", () => {
    it("回傳已發佈的遊戲列表", async () => {
      const mockGames = [
        { id: "g1", title: "遊戲A", status: "published" },
        { id: "g2", title: "遊戲B", status: "published" },
      ];
      mockStorage.getPublishedGames.mockResolvedValue(mockGames);

      const app = createTestApp();
      const res = await request(app).get("/api/games");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockGames);
      expect(mockStorage.getPublishedGames).toHaveBeenCalledOnce();
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getPublishedGames.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app).get("/api/games");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("Failed to fetch games");
    });
  });

  describe("GET /api/games/:id", () => {
    it("回傳遊戲詳細資料（含頁面）", async () => {
      const mockGame = {
        id: "g1",
        title: "遊戲A",
        pages: [{ id: "p1", pageType: "text_card" }],
      };
      mockStorage.getGameWithPages.mockResolvedValue(mockGame);

      const app = createTestApp();
      const res = await request(app).get("/api/games/g1");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockGame);
      expect(mockStorage.getGameWithPages).toHaveBeenCalledWith("g1");
    });

    it("找不到遊戲回傳 404", async () => {
      mockStorage.getGameWithPages.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app).get("/api/games/nonexistent");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Game not found");
    });
  });

  describe("POST /api/games", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/games")
        .send({ title: "新遊戲" });

      expect(res.status).toBe(401);
    });

    it("成功建立遊戲回傳 201", async () => {
      const newGame = { id: "g-new", title: "新遊戲", creatorId: "user-1" };
      mockStorage.createGame.mockResolvedValue(newGame);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "新遊戲" });

      expect(res.status).toBe(201);
      expect(res.body).toEqual(newGame);
      expect(mockStorage.createGame).toHaveBeenCalledWith(
        expect.objectContaining({ title: "新遊戲", creatorId: "user-1" }),
      );
    });

    it("缺少 title 回傳 400（Zod 驗證）", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/games")
        .set("Authorization", "Bearer valid-token")
        .send({ description: "沒有標題" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Invalid data");
      expect(res.body.errors).toBeDefined();
    });
  });

  describe("PATCH /api/games/:id", () => {
    it("遊戲擁有者可以更新", async () => {
      mockStorage.getUser.mockResolvedValue({ id: "user-1", role: "creator" });
      mockStorage.getGame.mockResolvedValue({ id: "g1", creatorId: "user-1" });
      mockStorage.updateGame.mockResolvedValue({
        id: "g1",
        title: "更新後的標題",
      });

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/games/g1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "更新後的標題" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("更新後的標題");
    });

    it("非擁有者回傳 403", async () => {
      mockStorage.getUser.mockResolvedValue({ id: "user-1", role: "creator" });
      mockStorage.getGame.mockResolvedValue({
        id: "g1",
        creatorId: "other-user",
      });

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/games/g1")
        .set("Authorization", "Bearer valid-token")
        .send({ title: "偷改" });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/games/:id", () => {
    it("遊戲擁有者可以刪除", async () => {
      mockStorage.getUser.mockResolvedValue({ id: "user-1", role: "creator" });
      mockStorage.getGame.mockResolvedValue({ id: "g1", creatorId: "user-1" });
      mockStorage.deleteGame.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app)
        .delete("/api/games/g1")
        .set("Authorization", "Bearer valid-token");

      expect(res.status).toBe(204);
      expect(mockStorage.deleteGame).toHaveBeenCalledWith("g1");
    });
  });

  describe("GET /api/games/:gameId/pages", () => {
    it("回傳遊戲的頁面列表", async () => {
      const mockPages = [
        { id: "p1", pageType: "text_card", pageOrder: 1 },
        { id: "p2", pageType: "dialogue", pageOrder: 2 },
      ];
      mockStorage.getPages.mockResolvedValue(mockPages);

      const app = createTestApp();
      const res = await request(app).get("/api/games/g1/pages");

      expect(res.status).toBe(200);
      expect(res.body).toEqual(mockPages);
      expect(mockStorage.getPages).toHaveBeenCalledWith("g1");
    });
  });
});
