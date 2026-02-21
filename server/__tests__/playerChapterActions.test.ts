// 玩家章節路由測試 — POST/PATCH 動作類（開始、完成）
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
  makeProgress,
  resetStorageMocks,
  AUTH_HEADER,
} from "./helpers/playerChapterSetup";

describe("玩家章節路由（動作）", () => {
  beforeEach(() => {
    resetStorageMocks();
  });

  // ======================================================================
  // POST /api/games/:gameId/chapters/:chapterId/start（開始章節）
  // ======================================================================
  describe("POST /api/games/:gameId/chapters/:chapterId/start", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).post(
        "/api/games/game-1/chapters/ch-1/start"
      );

      expect(res.status).toBe(401);
    });

    it("章節未解鎖回傳 403", async () => {
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: false, reason: "locked" });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("章節尚未解鎖");
    });

    it("建立新進度（首次遊玩）", async () => {
      const progress = makeProgress({ status: "in_progress" });
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);
      mockStorage.createChapterProgress.mockResolvedValue(progress);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
      expect(mockStorage.createChapterProgress).toHaveBeenCalledWith({
        userId: "player-1",
        gameId: "game-1",
        chapterId: "ch-1",
        status: "in_progress",
      });
    });

    it("更新 unlocked → in_progress", async () => {
      const existing = makeProgress({ status: "unlocked" });
      const updated = makeProgress({ status: "in_progress" });
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(existing);
      mockStorage.updateChapterProgress.mockResolvedValue(updated);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(mockStorage.updateChapterProgress).toHaveBeenCalledWith(
        "prog-1",
        { status: "in_progress" }
      );
    });

    it("已完成但不允許重玩回傳 400", async () => {
      const existing = makeProgress({ status: "completed" });
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(existing);
      mockStorage.getGame.mockResolvedValue({
        id: "game-1",
        allowChapterReplay: false,
      });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此遊戲不允許重玩已完成的章節");
    });

    it("已完成且允許重玩 → 重設為 in_progress", async () => {
      const existing = makeProgress({ status: "completed" });
      const replayed = makeProgress({ status: "in_progress" });
      mockStorage.isChapterUnlocked.mockResolvedValue({ unlocked: true });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(existing);
      mockStorage.getGame.mockResolvedValue({
        id: "game-1",
        allowChapterReplay: true,
      });
      mockStorage.updateChapterProgress.mockResolvedValue(replayed);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("in_progress");
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.isChapterUnlocked.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/start")
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法開始章節");
    });
  });

  // ======================================================================
  // PATCH /api/sessions/:id/chapter-complete（完成章節）
  // ======================================================================
  describe("PATCH /api/sessions/:id/chapter-complete", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).patch(
        "/api/sessions/sess-1/chapter-complete"
      );

      expect(res.status).toBe(401);
    });

    it("場次不存在回傳 404", async () => {
      mockStorage.getSession.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-999/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 80 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("場次不存在");
    });

    it("場次無章節回傳 400", async () => {
      mockStorage.getSession.mockResolvedValue({
        id: "sess-1",
        currentChapterId: null,
        gameId: "game-1",
      });

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 80 });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此場次不屬於任何章節");
    });

    it("找不到章節進度回傳 404", async () => {
      mockStorage.getSession.mockResolvedValue({
        id: "sess-1",
        currentChapterId: "ch-1",
        gameId: "game-1",
      });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 80 });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("找不到章節進度");
    });

    it("完成章節並解鎖下一章", async () => {
      mockStorage.getSession.mockResolvedValue({
        id: "sess-1",
        currentChapterId: "ch-1",
        gameId: "game-1",
      });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(
        makeProgress({ bestScore: 50 })
      );
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.unlockNextChapter.mockResolvedValue(
        makeProgress({ id: "prog-2", chapterId: "ch-2", status: "unlocked" })
      );

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 80 });

      expect(res.status).toBe(200);
      expect(res.body.completed).toBe(true);
      expect(res.body.bestScore).toBe(80);
      expect(res.body.nextChapterUnlocked).toBe(true);
      expect(res.body.nextChapterId).toBe("ch-2");
    });

    it("分數低於歷史最高保留最高分", async () => {
      mockStorage.getSession.mockResolvedValue({
        id: "sess-1",
        currentChapterId: "ch-1",
        gameId: "game-1",
      });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(
        makeProgress({ bestScore: 95 })
      );
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.unlockNextChapter.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 60 });

      expect(res.status).toBe(200);
      expect(res.body.bestScore).toBe(95);
      expect(res.body.nextChapterUnlocked).toBe(false);
    });

    it("無 score 預設為 0", async () => {
      mockStorage.getSession.mockResolvedValue({
        id: "sess-1",
        currentChapterId: "ch-1",
        gameId: "game-1",
      });
      mockStorage.getChapterProgressByChapter.mockResolvedValue(
        makeProgress({ bestScore: 0 })
      );
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.unlockNextChapter.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.bestScore).toBe(0);
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getSession.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .patch("/api/sessions/sess-1/chapter-complete")
        .set(AUTH_HEADER)
        .send({ score: 80 });

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法完成章節");
    });
  });
});
