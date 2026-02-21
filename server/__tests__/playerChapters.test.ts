// 玩家章節路由測試
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
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

// Mock Firebase 認證
vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: any, _res: any, next: any) => {
    if (req.headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "player-1" },
        dbUser: { id: "player-1", role: "player" },
      };
      return next();
    }
    return _res.status(401).json({ message: "Unauthorized" });
  }),
  verifyFirebaseToken: vi.fn(),
}));

// Mock adminAuth（部分路由可能間接引用）
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

import { storage } from "../storage";
import { registerPlayerChapterRoutes } from "../routes/player-chapters";

const mockStorage = storage as {
  getGame: ReturnType<typeof vi.fn>;
  getChapters: ReturnType<typeof vi.fn>;
  getChapter: ReturnType<typeof vi.fn>;
  getChapterWithPages: ReturnType<typeof vi.fn>;
  isChapterUnlocked: ReturnType<typeof vi.fn>;
  getPlayerChapterProgress: ReturnType<typeof vi.fn>;
  getChapterProgressByChapter: ReturnType<typeof vi.fn>;
  createChapterProgress: ReturnType<typeof vi.fn>;
  updateChapterProgress: ReturnType<typeof vi.fn>;
  unlockNextChapter: ReturnType<typeof vi.fn>;
  getSession: ReturnType<typeof vi.fn>;
};

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerPlayerChapterRoutes(app);
  return app;
}

// 測試用資料工廠
function makeChapter(overrides = {}) {
  return {
    id: "ch-1",
    gameId: "game-1",
    title: "第一章",
    description: "測試",
    chapterOrder: 1,
    unlockType: "sequential",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeProgress(overrides = {}) {
  return {
    id: "prog-1",
    userId: "player-1",
    gameId: "game-1",
    chapterId: "ch-1",
    status: "in_progress",
    bestScore: 0,
    completedAt: null,
    lastPlayedAt: null,
    ...overrides,
  };
}

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

describe("玩家章節路由", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重設所有 storage mock 的預設回傳值，避免測試間洩漏
    mockStorage.getGame.mockReset();
    mockStorage.getChapters.mockReset();
    mockStorage.getChapter.mockReset();
    mockStorage.getChapterWithPages.mockReset();
    mockStorage.isChapterUnlocked.mockReset();
    mockStorage.getPlayerChapterProgress.mockReset();
    mockStorage.getChapterProgressByChapter.mockReset();
    mockStorage.createChapterProgress.mockReset();
    mockStorage.updateChapterProgress.mockReset();
    mockStorage.unlockNextChapter.mockReset();
    mockStorage.getSession.mockReset();
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
      // 第一章已完成
      expect(res.body[0].playerStatus).toBe("completed");
      expect(res.body[0].bestScore).toBe(95);
      // 第二章未開始但因為 sequential 所以 locked
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
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "free",
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
      // 第一章和 free 章節都解鎖
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
        makeProgress({
          id: "p-1",
          chapterId: "ch-1",
          status: "completed",
        }),
        makeProgress({
          id: "p-2",
          chapterId: "ch-2",
          status: "in_progress",
        }),
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
      expect(res.body.bestScore).toBe(80); // 80 > 50
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
      expect(res.body.bestScore).toBe(95); // 保留歷史最高
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

  // ======================================================================
  // GET /api/games/:gameId/chapters（score_threshold 自動解鎖）
  // ======================================================================
  describe("GET /api/games/:gameId/chapters（score_threshold 解鎖）", () => {
    it("分數達標自動解鎖 score_threshold 章節", async () => {
      const chapters = [
        makeChapter({
          id: "ch-1",
          chapterOrder: 1,
          unlockType: "free",
        }),
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "score_threshold",
          unlockConfig: { requiredScore: 50 },
        }),
      ];
      const progresses = [
        makeProgress({
          chapterId: "ch-1",
          status: "completed",
          bestScore: 60,
        }),
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
        makeChapter({
          id: "ch-1",
          chapterOrder: 1,
          unlockType: "free",
        }),
        makeChapter({
          id: "ch-2",
          chapterOrder: 2,
          unlockType: "score_threshold",
          unlockConfig: { requiredScore: 100 },
        }),
      ];
      const progresses = [
        makeProgress({
          chapterId: "ch-1",
          status: "completed",
          bestScore: 30,
        }),
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
        makeChapter({
          id: "ch-1",
          chapterOrder: 1,
          unlockType: "free",
        }),
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
        makeChapter({
          id: "ch-1",
          gameId: "game-1",
          unlockType: "free",
        })
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

    it("成功購買解鎖章節（新建進度）", async () => {
      const paidChapter = makeChapter({
        id: "ch-paid",
        gameId: "game-1",
        unlockType: "paid",
        unlockConfig: { price: 30 },
      });
      const existingProgress = [
        makeProgress({
          id: "prog-1",
          chapterId: "ch-1",
          bestScore: 50,
        }),
      ];
      const newProgress = makeProgress({
        id: "prog-new",
        chapterId: "ch-paid",
        status: "unlocked",
      });

      mockStorage.getChapter.mockResolvedValue(paidChapter);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(
        existingProgress
      );
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);
      mockStorage.createChapterProgress.mockResolvedValue(newProgress);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.purchased).toBe(true);
      expect(res.body.pointsSpent).toBe(30);
      expect(res.body.remainingPoints).toBe(20);
      // 驗證扣分
      expect(mockStorage.updateChapterProgress).toHaveBeenCalledWith(
        "prog-1",
        { bestScore: 20 }
      );
      // 驗證建立進度
      expect(mockStorage.createChapterProgress).toHaveBeenCalledWith({
        userId: "player-1",
        gameId: "game-1",
        chapterId: "ch-paid",
        status: "unlocked",
      });
    });

    it("成功購買解鎖章節（更新既有 locked 進度）", async () => {
      const paidChapter = makeChapter({
        id: "ch-paid",
        gameId: "game-1",
        unlockType: "paid",
        unlockConfig: { price: 20 },
      });
      const existingProgress = [
        makeProgress({
          id: "prog-1",
          chapterId: "ch-1",
          bestScore: 40,
        }),
      ];
      const lockedProgress = makeProgress({
        id: "prog-locked",
        chapterId: "ch-paid",
        status: "locked",
      });
      const unlockedProgress = makeProgress({
        id: "prog-locked",
        chapterId: "ch-paid",
        status: "unlocked",
      });

      mockStorage.getChapter.mockResolvedValue(paidChapter);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(
        existingProgress
      );
      mockStorage.updateChapterProgress.mockResolvedValue(unlockedProgress);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(
        lockedProgress
      );

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/chapters/ch-paid/purchase")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.purchased).toBe(true);
      expect(res.body.pointsSpent).toBe(20);
    });

    it("從多個章節扣分（最高分優先）", async () => {
      const paidChapter = makeChapter({
        id: "ch-paid",
        gameId: "game-1",
        unlockType: "paid",
        unlockConfig: { price: 45 },
      });
      const progresses = [
        makeProgress({
          id: "prog-1",
          chapterId: "ch-1",
          bestScore: 30,
        }),
        makeProgress({
          id: "prog-2",
          chapterId: "ch-2",
          bestScore: 25,
        }),
      ];

      mockStorage.getChapter.mockResolvedValue(paidChapter);
      mockStorage.getPlayerChapterProgress.mockResolvedValue(progresses);
      mockStorage.updateChapterProgress.mockResolvedValue(undefined);
      mockStorage.getChapterProgressByChapter.mockResolvedValue(null);
      mockStorage.createChapterProgress.mockResolvedValue(
        makeProgress({ status: "unlocked" })
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
