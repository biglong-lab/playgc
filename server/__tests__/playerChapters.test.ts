// 玩家章節路由測試 — GET 查詢類（列表、詳情、進度）
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

// Mock storage 模組
vi.mock("../storage", () => ({
  storage: {
    getGame: vi.fn(),
    getChapters: vi.fn(),
    getChapter: vi.fn(),
    getChapterWithPages: vi.fn(),
    isChapterUnlocked: vi.fn(),
    getPlayerChapterProgress: vi.fn(),
    getChapterProgressByChapter: vi.fn(),
    createChapterProgress: vi.fn(),
    updateChapterProgress: vi.fn(),
    unlockNextChapter: vi.fn(),
    getSession: vi.fn(),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    const headers = req.headers as Record<string, string>;
    if (headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "player-1" },
        dbUser: { id: "player-1", role: "player" },
      };
      return next();
    }
    return ((_res as { status: (code: number) => { json: (body: unknown) => void } }).status(401).json({ message: "Unauthorized" }));
  }),
  verifyFirebaseToken: vi.fn(),
}));

vi.mock("../adminAuth", () => ({
  requireAdminAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  requirePermission: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
  adminAuthMiddleware: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  adminLogin: vi.fn(),
  adminLogout: vi.fn(),
  logAuditAction: vi.fn(),
  verifyToken: vi.fn(),
  getAdminPermissions: vi.fn(),
}));

import {
  mockStorage,
  createTestApp,
  makeChapter,
  makeProgress,
  resetStorageMocks,
  AUTH_HEADER,
} from "./helpers/playerChapterSetup";

describe("玩家章節路由（查詢）", () => {
  beforeEach(() => {
    resetStorageMocks();
  });

  // ======================================================================
  // GET /api/games/:gameId/chapters（章節列表 + 進度）
  // ======================================================================
  describe("GET /api/games/:gameId/chapters", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/games/game-1/chapters");

      expect(res.status).toBe(401);
    });

    it("遊戲不存在回傳 404", async () => {
      mockStorage.getGame.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/not-exist/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("遊戲不存在");
    });

    it("已認證玩家回傳含進度的章節列表", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1 }),
        makeChapter({ id: "ch-2", title: "第二章", chapterOrder: 2 }),
      ];
      const progresses = [
        makeProgress({ chapterId: "ch-1", status: "completed", bestScore: 95 }),
      ];

      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(progresses);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].playerStatus).toBe("completed");
      expect(res.body[0].bestScore).toBe(95);
      expect(res.body[1].playerStatus).toBe("locked");
    });

    it("第一章預設解鎖", async () => {
      const chapters = [makeChapter({ id: "ch-1", chapterOrder: 1 })];
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue([]);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[0].playerStatus).toBe("unlocked");
    });

    it("free 類型章節預設解鎖", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1 }),
        makeChapter({ id: "ch-2", chapterOrder: 2, unlockType: "free" }),
      ];
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue([]);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[0].playerStatus).toBe("unlocked");
      expect(res.body[1].playerStatus).toBe("unlocked");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法取得章節列表");
    });
  });

  // ======================================================================
  // GET /api/games/:gameId/chapters/:chapterId（章節詳情）
  // ======================================================================
  describe("GET /api/games/:gameId/chapters/:chapterId", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/games/game-1/chapters/ch-1");

      expect(res.status).toBe(401);
    });

    it("章節未解鎖回傳 403", async () => {
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: false, reason: "locked" });

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters/ch-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("章節尚未解鎖");
    });

    it("章節不存在回傳 404", async () => {
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterWithPages.mockResolvedValue(undefined);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters/ch-999")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("章節不存在");
    });

    it("已解鎖回傳章節含頁面", async () => {
      const chapterWithPages = {
        ...makeChapter(),
        pages: [
          { id: "page-1", title: "頁面1" },
          { id: "page-2", title: "頁面2" },
        ],
      };
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterWithPages.mockResolvedValue(chapterWithPages);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters/ch-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.pages).toHaveLength(2);
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.isChapterUnlocked.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters/ch-1")
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法取得章節詳情");
    });
  });

  // ======================================================================
  // GET /api/games/:gameId/progress（進度概覽）
  // ======================================================================
  describe("GET /api/games/:gameId/progress", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).get("/api/games/game-1/progress");

      expect(res.status).toBe(401);
    });

    it("回傳進度概覽", async () => {
      const chapters = [
        makeChapter({ id: "ch-1" }),
        makeChapter({ id: "ch-2" }),
        makeChapter({ id: "ch-3" }),
      ];
      const progresses = [
        makeProgress({ id: "p-1", chapterId: "ch-1", status: "completed" }),
        makeProgress({ id: "p-2", chapterId: "ch-2", status: "in_progress" }),
      ];

      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(progresses);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/progress")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.totalChapters).toBe(3);
      expect(res.body.completedChapters).toBe(1);
      expect(res.body.currentChapterId).toBe("ch-2");
      expect(res.body.progresses).toHaveLength(2);
    });

    it("無進度回傳預設值", async () => {
      mockStorage.getChapters.mockResolvedValue([makeChapter()]);
      mockStorage.getPlayerChapterProgress.mockResolvedValue([]);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/progress")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.completedChapters).toBe(0);
      expect(res.body.currentChapterId).toBeNull();
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getChapters.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/progress")
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法取得進度");
    });
  });
});
