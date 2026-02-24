// 管理端章節路由測試
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage 模組
vi.mock("../storage", () => ({
  storage: {
    getChapters: vi.fn(),
    getChapter: vi.fn(),
    createChapter: vi.fn(),
    updateChapter: vi.fn(),
    deleteChapter: vi.fn(),
    reorderChapters: vi.fn(),
    getGame: vi.fn(),
    getPage: vi.fn(),
  },
}));

// Mock db（用於頁面章節指定）
vi.mock("../db", () => ({
  db: {
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(),
        })),
      })),
    })),
  },
}));

// Mock adminAuth 中間件 - 預設放行
vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((_req: any, _res: any, next: any) => next()),
  requirePermission: vi.fn(
    () => (_req: any, _res: any, next: any) => next()
  ),
  adminAuthMiddleware: vi.fn((_req: any, _res: any, next: any) => next()),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  logAuditAction: vi.fn(),
  verifyToken: vi.fn(),
  getAdminPermissions: vi.fn(),
}));

// Mock Firebase 認證
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    req.user = {
      claims: { sub: "admin-user-1" },
      dbUser: { id: "admin-user-1", role: "admin" },
    };
    return next();
  }),
  verifyFirebaseToken: vi.fn(),
}));

import { storage } from "../storage";
import { registerAdminChapterRoutes } from "../routes/admin-chapters";

const mockStorage = storage as {
  getChapters: ReturnType<typeof vi.fn>;
  getChapter: ReturnType<typeof vi.fn>;
  createChapter: ReturnType<typeof vi.fn>;
  updateChapter: ReturnType<typeof vi.fn>;
  deleteChapter: ReturnType<typeof vi.fn>;
  reorderChapters: ReturnType<typeof vi.fn>;
  getGame: ReturnType<typeof vi.fn>;
  getPage: ReturnType<typeof vi.fn>;
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerAdminChapterRoutes(app);
  return app;
}

// 測試用資料工廠
function makeChapter(overrides = {}) {
  return {
    id: "ch-1",
    gameId: "game-1",
    title: "第一章",
    description: "測試章節",
    chapterOrder: 1,
    unlockType: "sequential",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("管理端章節路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ======================================================================
  // GET /api/admin/games/:gameId/chapters
  // ======================================================================
  describe("GET /api/admin/games/:gameId/chapters", () => {
    it("回傳章節列表", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1 }),
        makeChapter({ id: "ch-2", title: "第二章", chapterOrder: 2 }),
      ];
      mockStorage.getChapters.mockResolvedValue(chapters);

      const app = createTestApp();
      const res = await request(app).get("/api/admin/games/game-1/chapters");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.getChapters).toHaveBeenCalledWith("game-1");
    });

    it("空列表回傳空陣列", async () => {
      mockStorage.getChapters.mockResolvedValue([]);

      const app = createTestApp();
      const res = await request(app).get("/api/admin/games/game-1/chapters");

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getChapters.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app).get("/api/admin/games/game-1/chapters");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法取得章節列表");
    });
  });

  // ======================================================================
  // POST /api/admin/games/:gameId/chapters
  // ======================================================================
  describe("POST /api/admin/games/:gameId/chapters", () => {
    it("建立新章節", async () => {
      const newChapter = makeChapter();
      mockStorage.getGame.mockResolvedValue({ id: "game-1", title: "遊戲" });
      mockStorage.getChapters.mockResolvedValue([]);
      mockStorage.createChapter.mockResolvedValue(newChapter);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/chapters")
        .send({ title: "第一章", gameId: "game-1" });

      expect(res.status).toBe(201);
      expect(res.body.id).toBe("ch-1");
      expect(mockStorage.createChapter).toHaveBeenCalled();
    });

    it("遊戲不存在回傳 404", async () => {
      mockStorage.getGame.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/admin/games/not-exist/chapters")
        .send({ title: "章節" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("遊戲不存在");
    });

    it("自動計算排序（已有 2 章 → 第 3 章）", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue([
        makeChapter({ chapterOrder: 1 }),
        makeChapter({ id: "ch-2", chapterOrder: 2 }),
      ]);
      mockStorage.createChapter.mockResolvedValue(
        makeChapter({ id: "ch-3", chapterOrder: 3 })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/chapters")
        .send({ title: "第三章", gameId: "game-1" });

      expect(res.status).toBe(201);
      // 驗證 createChapter 被呼叫時 chapterOrder 為 3
      const callArg = mockStorage.createChapter.mock.calls[0][0];
      expect(callArg.chapterOrder).toBe(3);
    });

    it("驗證失敗回傳 400", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue([]);

      const app = createTestApp();
      // 送出不完整資料（缺少必要欄位）
      const res = await request(app)
        .post("/api/admin/games/game-1/chapters")
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("驗證失敗");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue([]);
      mockStorage.createChapter.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .post("/api/admin/games/game-1/chapters")
        .send({ title: "章節", gameId: "game-1" });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法建立章節");
    });
  });

  // ======================================================================
  // PATCH /api/admin/chapters/:id
  // ======================================================================
  describe("PATCH /api/admin/chapters/:id", () => {
    it("更新章節資料", async () => {
      const updated = makeChapter({ title: "更新後標題" });
      mockStorage.getChapter.mockResolvedValue(makeChapter());
      mockStorage.updateChapter.mockResolvedValue(updated);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/ch-1")
        .send({ title: "更新後標題" });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe("更新後標題");
      expect(mockStorage.updateChapter).toHaveBeenCalledWith("ch-1", {
        title: "更新後標題",
      });
    });

    it("章節不存在回傳 404", async () => {
      mockStorage.getChapter.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/not-exist")
        .send({ title: "test" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("章節不存在");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getChapter.mockResolvedValue(makeChapter());
      mockStorage.updateChapter.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/ch-1")
        .send({ title: "test" });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法更新章節");
    });
  });

  // ======================================================================
  // DELETE /api/admin/chapters/:id
  // ======================================================================
  describe("DELETE /api/admin/chapters/:id", () => {
    it("刪除章節成功", async () => {
      mockStorage.getChapter.mockResolvedValue(makeChapter());
      mockStorage.deleteChapter.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app).delete("/api/admin/chapters/ch-1");

      expect(res.status).toBe(200);
      expect(res.body.message).toBe("章節已刪除");
      expect(mockStorage.deleteChapter).toHaveBeenCalledWith("ch-1");
    });

    it("章節不存在回傳 404", async () => {
      mockStorage.getChapter.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app).delete("/api/admin/chapters/not-exist");

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("章節不存在");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getChapter.mockResolvedValue(makeChapter());
      mockStorage.deleteChapter.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app).delete("/api/admin/chapters/ch-1");

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法刪除章節");
    });
  });

  // ======================================================================
  // PATCH /api/admin/chapters/reorder
  // ======================================================================
  describe("PATCH /api/admin/chapters/reorder", () => {
    it("重新排序章節", async () => {
      const reordered = [
        makeChapter({ id: "ch-2", chapterOrder: 1 }),
        makeChapter({ id: "ch-1", chapterOrder: 2 }),
      ];
      mockStorage.reorderChapters.mockResolvedValue(undefined);
      mockStorage.getChapters.mockResolvedValue(reordered);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/reorder")
        .send({ gameId: "game-1", chapterIds: ["ch-2", "ch-1"] });

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(mockStorage.reorderChapters).toHaveBeenCalledWith("game-1", [
        "ch-2",
        "ch-1",
      ]);
    });

    it("缺少 gameId 回傳 400", async () => {
      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/reorder")
        .send({ chapterIds: ["ch-1"] });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("需要 gameId 和 chapterIds");
    });

    it("缺少 chapterIds 回傳 400", async () => {
      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/reorder")
        .send({ gameId: "game-1" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("需要 gameId 和 chapterIds");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.reorderChapters.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/chapters/reorder")
        .send({ gameId: "game-1", chapterIds: ["ch-1"] });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法重新排序");
    });
  });

  // ======================================================================
  // PATCH /api/admin/pages/:pageId/chapter
  // ======================================================================
  describe("PATCH /api/admin/pages/:pageId/chapter", () => {
    it("頁面不存在回傳 404", async () => {
      mockStorage.getPage.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/admin/pages/page-999/chapter")
        .send({ chapterId: "ch-1" });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("頁面不存在");
    });
  });
});
