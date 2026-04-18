// 玩家購買路由測試 — Checkout + 交易狀態 + 存取權
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// Mock storage
vi.mock("../storage", () => ({
  storage: {
    getGame: vi.fn(),
    getChapter: vi.fn(),
    getChapters: vi.fn(),
    getUserGamePurchase: vi.fn(),
    getUserChapterPurchase: vi.fn(),
    getTransaction: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    createPurchase: vi.fn(),
    getPurchasesByUser: vi.fn(),
    getRedeemCodeByCode: vi.fn(),
    hasUserRedeemedCode: vi.fn(),
    createCodeUse: vi.fn(),
    incrementRedeemCodeUsage: vi.fn(),
  },
}));

vi.mock("../db", () => ({
  db: {
    transaction: vi.fn((fn: () => Promise<void>) => fn()),
  },
}));

vi.mock("../firebaseAuth", () => ({
  isAuthenticated: vi.fn((req: Record<string, unknown>, _res: Record<string, unknown>, next: () => void) => {
    const headers = req.headers as Record<string, string>;
    if (headers.authorization === "Bearer valid-token") {
      req.user = {
        claims: { sub: "user-1", email: "test@test.com" },
        dbUser: { id: "user-1", role: "player" },
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

vi.mock("../services/recur-client", () => ({
  createCheckoutSession: vi.fn(),
  isRecurConfigured: vi.fn(),
  verifyWebhookSignature: vi.fn(),
}));

vi.mock("../services/billing", () => ({
  checkQuota: vi.fn().mockResolvedValue({
    current: 0,
    limit: null,
    isOver: false,
    percent: 0,
  }),
}));

import { storage } from "../storage";
import { createCheckoutSession, isRecurConfigured } from "../services/recur-client";
import { checkQuota } from "../services/billing";
import { registerPlayerPurchaseRoutes } from "../routes/player-purchases";

type MockFn = ReturnType<typeof vi.fn>;
const mockStorage = storage as unknown as Record<string, MockFn>;
const mockCreateCheckout = createCheckoutSession as MockFn;
const mockIsRecurConfigured = isRecurConfigured as MockFn;
const mockCheckQuota = checkQuota as unknown as MockFn;

const AUTH_HEADER = { Authorization: "Bearer valid-token" };

function createTestApp() {
  const app = express();
  app.use(express.json());
  registerPlayerPurchaseRoutes(app);
  return app;
}

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: "game-1",
    title: "測試遊戲",
    pricingType: "one_time",
    price: 100,
    currency: "TWD",
    recurProductId: "prod-001",
    ...overrides,
  };
}

describe("玩家購買路由 — Checkout + 交易", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRecurConfigured.mockReturnValue(true);
    mockCheckQuota.mockResolvedValue({
      current: 0,
      limit: null,
      isOver: false,
      percent: 0,
    });
  });

  // ======================================================================
  // POST /api/games/:gameId/checkout — 遊戲級
  // ======================================================================
  describe("POST /api/games/:gameId/checkout（遊戲級）", () => {
    it("免費遊戲 → 400", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "free" }));

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此遊戲為免費遊戲");
    });

    it("已有存取權 → 409", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame());
      mockStorage.getUserGamePurchase.mockResolvedValue({ id: "p-1" });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("您已擁有此遊戲存取權");
    });

    it("Recur 未設定 → 503", async () => {
      mockIsRecurConfigured.mockReturnValue(false);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(503);
      expect(res.body.message).toBe("線上付款功能尚未開放");
    });

    it("遊戲級 checkout 成功 → 回傳 checkoutUrl", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame());
      mockStorage.getUserGamePurchase.mockResolvedValue(null);
      mockStorage.createTransaction.mockResolvedValue({ id: "tx-001" });
      mockStorage.updateTransaction.mockResolvedValue(undefined);
      mockCreateCheckout.mockResolvedValue({
        id: "sess-001",
        url: "https://checkout.recur.tw/sess-001",
      });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.checkoutUrl).toBe("https://checkout.recur.tw/sess-001");
      expect(mockStorage.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
        userId: "user-1",
        gameId: "game-1",
        amount: 100,
        status: "pending",
      }));
    });

    it("SaaS 配額已滿 → 402 Payment Required", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ fieldId: "field-free-plan" }));
      mockStorage.getUserGamePurchase.mockResolvedValue(null);
      mockCheckQuota.mockResolvedValue({
        current: 100,
        limit: 100,
        isOver: true,
        percent: 100,
      });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(402);
      expect(res.body.message).toContain("已達方案上限");
      expect(res.body.quota).toEqual({ current: 100, limit: 100 });
      // 配額擋住後不應建立交易
      expect(mockStorage.createTransaction).not.toHaveBeenCalled();
      expect(mockCreateCheckout).not.toHaveBeenCalled();
    });

    it("遊戲無 fieldId → 跳過配額檢查（正常 checkout）", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ fieldId: null }));
      mockStorage.getUserGamePurchase.mockResolvedValue(null);
      mockStorage.createTransaction.mockResolvedValue({ id: "tx-orphan" });
      mockStorage.updateTransaction.mockResolvedValue(undefined);
      mockCreateCheckout.mockResolvedValue({ id: "s", url: "https://x" });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({});

      expect(res.status).toBe(200);
      expect(mockCheckQuota).not.toHaveBeenCalled();
    });

    it("未認證 → 401", async () => {
      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .send({});

      expect(res.status).toBe(401);
    });
  });

  // ======================================================================
  // POST /api/games/:gameId/checkout — 章節級
  // ======================================================================
  describe("POST /api/games/:gameId/checkout（章節級）", () => {
    it("非 per_chapter 遊戲不支援章節購買 → 400", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "one_time" }));

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({ chapterId: "ch-2" });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe("此遊戲不支援章節購買");
    });

    it("章節級 checkout 成功", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "per_chapter" }));
      mockStorage.getChapter.mockResolvedValue({
        id: "ch-2",
        gameId: "game-1",
        chapterOrder: 2,
        unlockConfig: { price: 50 },
      });
      mockStorage.getUserChapterPurchase.mockResolvedValue(null);
      mockStorage.createTransaction.mockResolvedValue({ id: "tx-002" });
      mockStorage.updateTransaction.mockResolvedValue(undefined);
      mockCreateCheckout.mockResolvedValue({
        id: "sess-002",
        url: "https://checkout.recur.tw/sess-002",
      });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({ chapterId: "ch-2" });

      expect(res.status).toBe(200);
      expect(res.body.checkoutUrl).toBe("https://checkout.recur.tw/sess-002");
      expect(mockStorage.createTransaction).toHaveBeenCalledWith(expect.objectContaining({
        amount: 50,
        chapterId: "ch-2",
      }));
    });

    it("章節不存在 → 404", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "per_chapter" }));
      mockStorage.getChapter.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({ chapterId: "ch-999" });

      expect(res.status).toBe(404);
    });

    it("已有章節存取權 → 409", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "per_chapter" }));
      mockStorage.getChapter.mockResolvedValue({
        id: "ch-2",
        gameId: "game-1",
        chapterOrder: 2,
        unlockConfig: { price: 50 },
      });
      mockStorage.getUserChapterPurchase.mockResolvedValue({ id: "p-2" });

      const app = createTestApp();
      const res = await request(app)
        .post("/api/games/game-1/checkout")
        .set(AUTH_HEADER)
        .send({ chapterId: "ch-2" });

      expect(res.status).toBe(409);
      expect(res.body.message).toBe("您已擁有此章節存取權");
    });
  });

  // ======================================================================
  // GET /api/transactions/:txId/status
  // ======================================================================
  describe("GET /api/transactions/:txId/status", () => {
    it("回傳交易狀態", async () => {
      mockStorage.getTransaction.mockResolvedValue({
        id: "tx-001",
        userId: "user-1",
        gameId: "game-1",
        chapterId: null,
        status: "completed",
      });

      const app = createTestApp();
      const res = await request(app)
        .get("/api/transactions/tx-001/status")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        status: "completed",
        gameId: "game-1",
        chapterId: null,
      });
    });

    it("交易不存在 → 404", async () => {
      mockStorage.getTransaction.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/transactions/tx-999/status")
        .set(AUTH_HEADER);

      expect(res.status).toBe(404);
    });

    it("非本人交易 → 403", async () => {
      mockStorage.getTransaction.mockResolvedValue({
        id: "tx-001",
        userId: "other-user",
        gameId: "game-1",
        status: "completed",
      });

      const app = createTestApp();
      const res = await request(app)
        .get("/api/transactions/tx-001/status")
        .set(AUTH_HEADER);

      expect(res.status).toBe(403);
      expect(res.body.message).toBe("無權查看此交易");
    });
  });

  // ======================================================================
  // GET /api/games/:gameId/access
  // ======================================================================
  describe("GET /api/games/:gameId/access", () => {
    it("免費遊戲 → hasAccess: true", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame({ pricingType: "free" }));

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/access")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.hasAccess).toBe(true);
      expect(res.body.pricingType).toBe("free");
    });

    it("已購買 → hasAccess: true", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame());
      mockStorage.getUserGamePurchase.mockResolvedValue({
        id: "p-1",
        purchaseType: "online_payment",
      });

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/access")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.hasAccess).toBe(true);
      expect(res.body.purchaseType).toBe("online_payment");
    });

    it("未購買 one_time → hasAccess: false", async () => {
      mockStorage.getGame.mockResolvedValue(makeGame());
      mockStorage.getUserGamePurchase.mockResolvedValue(null);

      const app = createTestApp();
      const res = await request(app)
        .get("/api/games/game-1/access")
        .set(AUTH_HEADER);

      expect(res.status).toBe(200);
      expect(res.body.hasAccess).toBe(false);
      expect(res.body.price).toBe(100);
    });
  });
});
