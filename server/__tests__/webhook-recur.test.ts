// Recur Webhook 整合測試
import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import crypto from "crypto";

// Mock storage
vi.mock("../storage", () => ({
  storage: {
    getTransaction: vi.fn(),
    getTransactionByRecurSession: vi.fn(),
    updateTransaction: vi.fn(),
    createPurchase: vi.fn(),
    getGame: vi.fn(),
  },
}));

// Mock recur-client
vi.mock("../services/recur-client", () => ({
  verifyWebhookSignature: vi.fn(),
  isRecurConfigured: vi.fn(() => true),
}));

// Mock billing service（避免載入 db.ts）
vi.mock("../services/billing", () => ({
  incrementUsage: vi.fn().mockResolvedValue(1),
  recordTransactionFee: vi.fn().mockResolvedValue({ feeAmount: 5, feePercent: 5 }),
}));

import { storage } from "../storage";
import { verifyWebhookSignature } from "../services/recur-client";
import { incrementUsage, recordTransactionFee } from "../services/billing";
import { registerRecurWebhookRoutes } from "../routes/webhook-recur";

type MockFn = ReturnType<typeof vi.fn>;
const mockStorage = storage as unknown as Record<string, MockFn>;
const mockVerify = verifyWebhookSignature as MockFn;
const mockIncrementUsage = incrementUsage as unknown as MockFn;
const mockRecordFee = recordTransactionFee as unknown as MockFn;

function createTestApp() {
  const app = express();
  // 模擬 rawBody 捕獲（與 server/index.ts 一致）
  app.use(express.json({
    verify: (req: express.Request, _res, buf) => {
      (req as express.Request & { rawBody: Buffer }).rawBody = buf;
    },
  }));
  registerRecurWebhookRoutes(app);
  return app;
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: "evt-001",
    type: "checkout.completed",
    timestamp: new Date().toISOString(),
    data: {
      checkout_session_id: "cs-123",
      payment_id: "pay-456",
      metadata: { transactionId: "tx-001", gameId: "game-1", userId: "user-1" },
    },
    ...overrides,
  };
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: "tx-001",
    userId: "user-1",
    gameId: "game-1",
    chapterId: null,
    amount: 100,
    currency: "TWD",
    status: "pending",
    ...overrides,
  };
}

describe("Recur Webhook 路由", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockVerify.mockReturnValue(true);
  });

  // ======================================================================
  // 簽名驗證
  // ======================================================================
  it("缺少簽名 → 401", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .send(makeEvent());

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("缺少簽名");
  });

  it("簽名驗證失敗 → 401", async () => {
    mockVerify.mockReturnValue(false);

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "invalid-sig")
      .send(makeEvent());

    expect(res.status).toBe(401);
    expect(res.body.message).toBe("簽名驗證失敗");
  });

  // ======================================================================
  // checkout.completed 事件
  // ======================================================================
  it("checkout.completed → 建立購買記錄", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent());

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockStorage.updateTransaction).toHaveBeenCalledWith("tx-001", expect.objectContaining({
      status: "completed",
    }));
    expect(mockStorage.createPurchase).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      gameId: "game-1",
      purchaseType: "online_payment",
      amount: 100,
      status: "completed",
    }));
  });

  it("checkout.completed 無 transactionId → 用 session ID 查找", async () => {
    const event = makeEvent({
      id: "evt-no-txid",
      data: {
        checkout_session_id: "cs-123",
        payment_id: "pay-456",
        metadata: {}, // 無 transactionId
      },
    });
    mockStorage.getTransactionByRecurSession.mockResolvedValue(makeTx());
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(event);

    expect(res.status).toBe(200);
    expect(mockStorage.getTransactionByRecurSession).toHaveBeenCalledWith("cs-123");
  });

  // ======================================================================
  // order.paid 事件
  // ======================================================================
  it("order.paid → 建立購買記錄", async () => {
    const event = makeEvent({ id: "evt-002", type: "order.paid" });
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(event);

    expect(res.status).toBe(200);
    expect(mockStorage.createPurchase).toHaveBeenCalled();
  });

  // ======================================================================
  // 冪等性
  // ======================================================================
  it("重複事件不重複處理", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);

    const app = createTestApp();
    const event = makeEvent({ id: "evt-dup" });

    // 第一次
    await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(event);

    // 第二次（同 event.id）
    const res2 = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(event);

    expect(res2.status).toBe(200);
    expect(res2.body.duplicate).toBe(true);
    // createPurchase 只應呼叫一次
    expect(mockStorage.createPurchase).toHaveBeenCalledTimes(1);
  });

  // ======================================================================
  // 交易已完成不重複處理
  // ======================================================================
  it("交易已完成 → 不重複建立購買記錄", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx({ status: "completed" }));

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-completed" }));

    expect(res.status).toBe(200);
    expect(mockStorage.updateTransaction).not.toHaveBeenCalled();
    expect(mockStorage.createPurchase).not.toHaveBeenCalled();
  });

  // ======================================================================
  // 未知事件類型
  // ======================================================================
  it("未知事件類型 → 200", async () => {
    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-unknown", type: "unknown.event" }));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
    expect(mockStorage.getTransaction).not.toHaveBeenCalled();
  });

  // ======================================================================
  // 處理錯誤仍回 200
  // ======================================================================
  it("處理過程出錯仍回 200", async () => {
    mockStorage.getTransaction.mockRejectedValue(new Error("DB error"));

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-error" }));

    expect(res.status).toBe(200);
    expect(res.body.error).toBe("processing_failed");
  });

  // ======================================================================
  // SaaS 計費 hook（Phase 6 實作驗證）
  // ======================================================================
  it("付款成功 → 觸發 incrementUsage + recordTransactionFee", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);
    mockStorage.getGame.mockResolvedValue({
      id: "game-1",
      fieldId: "field-jiachun",
      title: "賈村大冒險",
    });

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-billing-1" }));

    expect(res.status).toBe(200);
    // 用量 +1
    expect(mockIncrementUsage).toHaveBeenCalledWith("field-jiachun", "checkouts", 1);
    // 平台抽成
    expect(mockRecordFee).toHaveBeenCalledWith(expect.objectContaining({
      fieldId: "field-jiachun",
      sourceTransactionId: "tx-001",
      sourceAmount: 100,
    }));
  });

  it("game 無 fieldId → 跳過 billing hook", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);
    mockStorage.getGame.mockResolvedValue({ id: "game-orphan", fieldId: null });

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-billing-2" }));

    expect(res.status).toBe(200);
    expect(mockIncrementUsage).not.toHaveBeenCalled();
    expect(mockRecordFee).not.toHaveBeenCalled();
  });

  it("billing 失敗不影響主流程（購買仍完成）", async () => {
    mockStorage.getTransaction.mockResolvedValue(makeTx());
    mockStorage.updateTransaction.mockResolvedValue(undefined);
    mockStorage.createPurchase.mockResolvedValue(undefined);
    mockStorage.getGame.mockResolvedValue({ id: "game-1", fieldId: "field-1" });
    mockIncrementUsage.mockRejectedValueOnce(new Error("billing DB down"));

    const app = createTestApp();
    const res = await request(app)
      .post("/api/webhooks/recur")
      .set("x-recur-signature", "valid-sig")
      .send(makeEvent({ id: "evt-billing-3" }));

    // 主流程仍成功（webhook 本來就要回 200）
    expect(res.status).toBe(200);
    expect(mockStorage.createPurchase).toHaveBeenCalled();
  });
});
