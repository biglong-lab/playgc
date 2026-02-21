// 玩家章節路由測試 — 解鎖 + 購買類（score_threshold、paid）
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

describe("玩家章節路由（解鎖與購買）", () => {
  beforeEach(() => {
    resetStorageMocks();
  });

  // ======================================================================
  // GET /api/games/:gameId/chapters（score_threshold 自動解鎖）
  // ======================================================================
  describe("GET /api/games/:gameId/chapters（score_threshold 解鎖）", () => {
    it("分數達標自動解鎖 score_threshold 章節", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1, unlockType: "free" }),
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "score_threshold",
          unlockConfig: { requiredScore: 50 },
        }),
      ];
      const progresses = [
        makeProgress({ chapterId: "ch-1", status: "completed", bestScore: 60 }),
      ];

      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(progresses);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[1].playerStatus).toBe("unlocked");
      expect(res.body[1].unlockDetail.requiredScore).toBe(50);
      expect(res.body[1].unlockDetail.currentScore).toBe(60);
    });

    it("分數未達標保持 locked", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1, unlockType: "free" }),
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "score_threshold",
          unlockConfig: { requiredScore: 100 },
        }),
      ];
      const progresses = [
        makeProgress({ chapterId: "ch-1", status: "completed", bestScore: 30 }),
      ];

      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(progresses);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[1].playerStatus).toBe("locked");
      expect(res.body[1].unlockDetail.requiredScore).toBe(100);
      expect(res.body[1].unlockDetail.currentScore).toBe(30);
    });

    it("paid 章節附帶價格資訊", async () => {
      const chapters = [
        makeChapter({ id: "ch-1", chapterOrder: 1, unlockType: "free" }),
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "paid",
          unlockConfig: { price: 30 },
        }),
      ];

      mockStorage.getGame.mockResolvedValue({ id: "game-1" });
      mockStorage.getChapters.mockResolvedValue(chapters);
      mockStorage.getPlayerChapterProgress.mockResolvedValue([]);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/chapters")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body[1].playerStatus).toBe("locked");
      expect(res.body[1].unlockDetail.price).toBe(30);
    });
  });

  // ======================================================================
  // POST /api/games/:gameId/chapters/:chapterId/purchase（購買章節）
  // ======================================================================
  describe("POST /api/games/:gameId/chapters/:chapterId/purchase", () => {
    it("未認證回傳 401", async () => {
      const app = createTestApp();
      const res = await request(app).post(
        "/api/games/game-1/chapters/ch-1/purchase"
      );

      expect(res.status).toBe(401);
    });

    it("章節不存在回傳 404", async () => {
      mockStorage.getChapter.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-999/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("章節不存在");
    });

    it("章節 gameId 不符回傳 404", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({ id: "ch-1", gameId: "other-game" })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
      expect(res.body.message).toBe("章節不存在");
    });

    it("非 paid 章節回傳 400", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({ id: "ch-1", gameId: "game-1", unlockType: "free" })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此章節不需購買");
    });

    it("點數不足回傳 400", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({
          id: "ch-paid",
          gameId: "game-1",
          unlockType: "paid",
          unlockConfig: { price: 50 },
        })
      );
      mockStorage.getPlayerChapterProgress.mockResolvedValue([
        makeProgress({ bestScore: 20 }),
      ]);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("點數不足");
      expect(res.body.requiredPoints).toBe(50);
      expect(res.body.currentPoints).toBe(20);
    });

    it("購買成功（新建進度）", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({
          id: "ch-paid",
          gameId: "game-1",
          unlockType: "paid",
          unlockConfig: { price: 30 },
        })
      );
      mockStorage.getPlayerChapterProgress.mockResolvedValue([
        makeProgress({ id: "prog-1", bestScore: 50 }),
      ]);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.createChapterProgress.mockResolvedValue(
        makeProgress({
          id: "prog-new",
          chapterId: "ch-paid",
          status: "unlocked",
        })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.purchased).toBe(true);
      expect(res.body.pointsSpent).toBe(30);
      expect(res.body.remainingPoints).toBe(20);
    });

    it("購買成功（更新既有 locked 進度）", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({
          id: "ch-paid",
          gameId: "game-1",
          unlockType: "paid",
          unlockConfig: { price: 20 },
        })
      );
      mockStorage.getPlayerChapterProgress.mockResolvedValue([
        makeProgress({ id: "prog-1", bestScore: 40 }),
      ]);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(
        makeProgress({
          id: "prog-existing",
          chapterId: "ch-paid",
          status: "locked",
        })
      );
      mockStorage.updateChapterProgress.mockResolvedValue(
        makeProgress({
          id: "prog-existing",
          chapterId: "ch-paid",
          status: "unlocked",
        })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.purchased).toBe(true);
      expect(res.body.pointsSpent).toBe(20);
    });

    it("多章節扣除：從最高分開始扣", async () => {
      mockStorage.getChapter.mockResolvedValue(
        makeChapter({
          id: "ch-paid",
          gameId: "game-1",
          unlockType: "paid",
          unlockConfig: { price: 45 },
        })
      );
      mockStorage.getPlayerChapterProgress.mockResolvedValue([
        makeProgress({ id: "prog-1", chapterId: "ch-1", bestScore: 30 }),
        makeProgress({ id: "prog-2", chapterId: "ch-2", bestScore: 25 }),
      ]);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.createChapterProgress.mockResolvedValue(
        makeProgress({
          id: "prog-new",
          chapterId: "ch-paid",
          status: "unlocked",
        })
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.purchased).toBe(true);
      expect(res.body.pointsSpent).toBe(45);
      expect(res.body.remainingPoints).toBe(10);
      // 第一次扣最高分章節（30 分，扣 30）
      expect(mockStorage.updateChapterProgress).toHaveBeenCalledWith(
        "prog-1",
        { bestScore: 0 }
      );
      // 第二次扣次高分章節（25 分，扣 15）
      expect(mockStorage.updateChapterProgress).toHaveBeenCalledWith(
        "prog-2",
        { bestScore: 10 }
      );
    });

    it("storage 錯誤回傳 500", async () => {
      mockStorage.getChapter.mockRejectedValue(new Error("DB error"));

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-1/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(500);
      expect(res.body.message).toBe("無法購買章節");
    });
  });
});
