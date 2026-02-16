import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage
const { mockStorage } = vi.hoisted(() => ({
  mockStorage: {
    // Items
    getItems: vi.fn(),
    getItem: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    // Pages
    getPages: vi.fn(),
    getPage: vi.fn(),
    createPage: vi.fn(),
    updatePage: vi.fn(),
    deletePage: vi.fn(),
    // Events
    getEvents: vi.fn(),
    getEvent: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    // Achievements
    getAchievements: vi.fn(),
    getAchievement: vi.fn(),
    createAchievement: vi.fn(),
    updateAchievement: vi.fn(),
    deleteAchievement: vi.fn(),
    // Games
    getGame: vi.fn(),
  },
}));

vi.mock("../storage", () => ({ storage: mockStorage }));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers["x-admin-id"]) {
      req.admin = {
        id: req.headers["x-admin-id"],
        fieldId: req.headers["x-field-id"] || "field-1",
        systemRole: req.headers["x-system-role"] || "field_admin",
      };
      return next();
    }
    return _res.status(401).json({ message: "未認證" });
  }),
  requirePermission: vi.fn(() => (req: any, _res: any, next: any) => {
    if (!req.admin) return _res.status(401).json({ message: "未認證" });
    return next();
  }),
}));

vi.mock("@shared/schema", () => ({
  insertItemSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
    partial: vi.fn().mockReturnValue({ parse: vi.fn((data: Record<string, unknown>) => data) }),
  },
  insertPageSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
    partial: vi.fn().mockReturnValue({ parse: vi.fn((data: Record<string, unknown>) => data) }),
  },
  insertEventSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
    partial: vi.fn().mockReturnValue({ parse: vi.fn((data: Record<string, unknown>) => data) }),
  },
  insertAchievementSchema: {
    parse: vi.fn((data: Record<string, unknown>) => data),
    partial: vi.fn().mockReturnValue({ parse: vi.fn((data: Record<string, unknown>) => data) }),
  },
}));

import { registerAdminContentRoutes } from "../routes/admin-content";

function createApp() {
  const app = express();
  app.use(express.json());
  registerAdminContentRoutes(app);
  return app;
}

const headers = { "x-admin-id": "admin-1", "x-field-id": "field-1" };
const mockGame = { id: "game-1", fieldId: "field-1", title: "遊戲" };

describe("Admin Content 路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================
  // Items
  // ========================
  describe("Items CRUD", () => {
    it("GET /api/admin/games/:gameId/items 回傳道具列表", async () => {
      const app = createApp();
      const items = [{ id: "i1", name: "鑰匙" }, { id: "i2", name: "地圖" }];
      mockStorage.getItems.mockResolvedValueOnce(items);

      const res = await request(app).get("/api/admin/games/game-1/items").set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });

    it("POST /api/admin/games/:gameId/items 建立道具", async () => {
      const app = createApp();
      const item = { id: "i3", name: "藥水", gameId: "game-1" };
      mockStorage.createItem.mockResolvedValueOnce(item);

      const res = await request(app)
        .post("/api/admin/games/game-1/items")
        .set(headers)
        .send({ name: "藥水" });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe("藥水");
    });

    it("GET /api/admin/items/:id 不存在回 404", async () => {
      const app = createApp();
      mockStorage.getItem.mockResolvedValueOnce(null);

      const res = await request(app).get("/api/admin/items/non-exist").set(headers);
      expect(res.status).toBe(404);
    });

    it("PATCH /api/admin/items/:id 更新道具", async () => {
      const app = createApp();
      mockStorage.getItem.mockResolvedValueOnce({ id: "i1", name: "鑰匙" });
      mockStorage.updateItem.mockResolvedValueOnce({ id: "i1", name: "黃金鑰匙" });

      const res = await request(app)
        .patch("/api/admin/items/i1")
        .set(headers)
        .send({ name: "黃金鑰匙" });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("黃金鑰匙");
    });

    it("DELETE /api/admin/items/:id 刪除道具", async () => {
      const app = createApp();
      mockStorage.getItem.mockResolvedValueOnce({ id: "i1", name: "鑰匙" });
      mockStorage.deleteItem.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/items/i1").set(headers);
      expect(res.status).toBe(204);
    });

    it("DELETE 不存在的道具回 404", async () => {
      const app = createApp();
      mockStorage.getItem.mockResolvedValueOnce(null);

      const res = await request(app).delete("/api/admin/items/non-exist").set(headers);
      expect(res.status).toBe(404);
    });
  });

  // ========================
  // Pages
  // ========================
  describe("Pages CRUD", () => {
    it("GET /api/admin/games/:gameId/pages 遊戲不存在回 404", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(null);

      const res = await request(app).get("/api/admin/games/non-exist/pages").set(headers);
      expect(res.status).toBe(404);
    });

    it("GET 非同場域回 403", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce({ ...mockGame, fieldId: "other-field" });

      const res = await request(app).get("/api/admin/games/game-1/pages").set(headers);
      expect(res.status).toBe(403);
    });

    it("GET 成功回傳頁面列表", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.getPages.mockResolvedValueOnce([{ id: "p1", pageType: "text" }]);

      const res = await request(app).get("/api/admin/games/game-1/pages").set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("POST 成功建立頁面", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.createPage.mockResolvedValueOnce({ id: "p2", pageType: "video" });

      const res = await request(app)
        .post("/api/admin/games/game-1/pages")
        .set(headers)
        .send({ pageType: "video", pageOrder: 1 });

      expect(res.status).toBe(201);
    });

    it("PATCH 頁面不存在回 404", async () => {
      const app = createApp();
      mockStorage.getPage.mockResolvedValueOnce(null);

      const res = await request(app).patch("/api/admin/pages/non-exist").set(headers).send({ pageType: "text" });
      expect(res.status).toBe(404);
    });

    it("DELETE 頁面成功", async () => {
      const app = createApp();
      mockStorage.getPage.mockResolvedValueOnce({ id: "p1", gameId: "game-1" });
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.deletePage.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/pages/p1").set(headers);
      expect(res.status).toBe(204);
    });
  });

  // ========================
  // Events
  // ========================
  describe("Events CRUD", () => {
    it("GET 遊戲不存在回 404", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(null);

      const res = await request(app).get("/api/admin/games/non-exist/events").set(headers);
      expect(res.status).toBe(404);
    });

    it("GET 成功回傳事件列表", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.getEvents.mockResolvedValueOnce([{ id: "e1", name: "觸發器" }]);

      const res = await request(app).get("/api/admin/games/game-1/events").set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("POST 成功建立事件", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.createEvent.mockResolvedValueOnce({ id: "e2", name: "新事件" });

      const res = await request(app)
        .post("/api/admin/games/game-1/events")
        .set(headers)
        .send({ name: "新事件", eventType: "trigger" });

      expect(res.status).toBe(201);
    });

    it("PATCH 事件不存在回 404", async () => {
      const app = createApp();
      mockStorage.getEvent.mockResolvedValueOnce(null);

      const res = await request(app).patch("/api/admin/events/non-exist").set(headers).send({ name: "更新" });
      expect(res.status).toBe(404);
    });

    it("DELETE 事件非同場域回 403", async () => {
      const app = createApp();
      mockStorage.getEvent.mockResolvedValueOnce({ id: "e1", gameId: "game-1" });
      mockStorage.getGame.mockResolvedValueOnce({ ...mockGame, fieldId: "other-field" });

      const res = await request(app).delete("/api/admin/events/e1").set(headers);
      expect(res.status).toBe(403);
    });

    it("DELETE 事件成功", async () => {
      const app = createApp();
      mockStorage.getEvent.mockResolvedValueOnce({ id: "e1", gameId: "game-1" });
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.deleteEvent.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/events/e1").set(headers);
      expect(res.status).toBe(204);
    });
  });

  // ========================
  // Achievements
  // ========================
  describe("Achievements CRUD", () => {
    it("GET 遊戲不存在回 404", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(null);

      const res = await request(app).get("/api/admin/games/non-exist/achievements").set(headers);
      expect(res.status).toBe(404);
    });

    it("GET 成功回傳成就列表", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.getAchievements.mockResolvedValueOnce([{ id: 1, title: "探索者" }]);

      const res = await request(app).get("/api/admin/games/game-1/achievements").set(headers);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
    });

    it("POST 成功建立成就", async () => {
      const app = createApp();
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.createAchievement.mockResolvedValueOnce({ id: 2, title: "勇者" });

      const res = await request(app)
        .post("/api/admin/games/game-1/achievements")
        .set(headers)
        .send({ title: "勇者", icon: "sword" });

      expect(res.status).toBe(201);
    });

    it("PATCH 成就不存在回 404", async () => {
      const app = createApp();
      mockStorage.getAchievement.mockResolvedValueOnce(null);

      const res = await request(app).patch("/api/admin/achievements/999").set(headers).send({ title: "更新" });
      expect(res.status).toBe(404);
    });

    it("DELETE 成就成功", async () => {
      const app = createApp();
      mockStorage.getAchievement.mockResolvedValueOnce({ id: 1, gameId: "game-1" });
      mockStorage.getGame.mockResolvedValueOnce(mockGame);
      mockStorage.deleteAchievement.mockResolvedValueOnce(undefined);

      const res = await request(app).delete("/api/admin/achievements/1").set(headers);
      expect(res.status).toBe(204);
    });

    it("未認證應回 401", async () => {
      const app = createApp();
      const res = await request(app).get("/api/admin/games/game-1/achievements");
      expect(res.status).toBe(401);
    });
  });
});
