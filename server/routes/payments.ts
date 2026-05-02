// 💳 Payments — Stripe Checkout endpoints（W10 D1）
//
// 端點：
//   POST /api/payments/create-checkout
//     公開（不需登入）— 客戶端建立 Checkout Session 後跳轉付款
//   POST /api/payments/webhook
//     Stripe webhook 接收 checkout.session.completed
//
// 環境變數：
//   STRIPE_SECRET_KEY  - Stripe API key（sk_test_* / sk_live_*）
//   STRIPE_WEBHOOK_SECRET - Webhook signing secret（whsec_*）
//
// 若未設定環境變數 → endpoint 回 503（graceful degradation）

import type { Express } from "express";
import { createCheckoutSession } from "../lib/stripe-checkout";
import { getScenarioById } from "@shared/scenario-templates";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

/** 預設定價（依規模與情境）*/
function defaultPrice(scenarioId: string): { amountCents: number; productName: string } | null {
  const scenario = getScenarioById(scenarioId);
  if (!scenario) return null;

  // 簡化版定價（依分類給定預設）— 真實使用 admin 應在後台設訂價
  const pricing: Record<string, number> = {
    social: 600000,      // 婚禮 / 生日 / 同學會 NT$ 6,000
    event: 800000,       // 園遊會 / 破冰 / 頒獎 NT$ 8,000
    public: 15000_00,    // 街區走讀 / 商圈 NT$ 15,000
    corporate: 12000_00, // 內訓 / 旅遊 NT$ 12,000
    venue: 5000_00,      // 場域故事 NT$ 5,000
  };

  return {
    amountCents: pricing[scenario.category] ?? 600000,
    productName: scenario.name,
  };
}

export function registerPaymentsRoutes(app: Express) {
  /**
   * POST /api/payments/create-checkout
   * Body: { scenarioId: string, customerEmail?: string, displayName?: string }
   *
   * 公開（不需登入）— 客戶可在 /pricing 直接下單
   * 不寫入 DB（純 Stripe API 呼叫）— 真正的解鎖在 webhook
   */
  app.post("/api/payments/create-checkout", async (req, res) => {
    try {
      if (!STRIPE_KEY) {
        return res.status(503).json({
          error: "付費系統未啟用（STRIPE_SECRET_KEY 未設定）",
          code: "STRIPE_NOT_CONFIGURED",
        });
      }

      const { scenarioId, customerEmail, displayName } = req.body ?? {};
      if (!scenarioId) {
        return res.status(400).json({ error: "缺少 scenarioId" });
      }

      const price = defaultPrice(scenarioId);
      if (!price) {
        return res.status(404).json({ error: "情境不存在" });
      }

      const origin = `${req.protocol}://${req.get("host")}`;

      const session = await createCheckoutSession({
        apiKey: STRIPE_KEY,
        productName: displayName || price.productName,
        productDescription: `情境模板：${price.productName}`,
        amountCents: price.amountCents,
        currency: "twd",
        successUrl: `${origin}/pricing/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${origin}/pricing?canceled=1`,
        customerEmail,
        metadata: {
          scenarioId,
          source: "template-market",
        },
      });

      res.json({
        checkoutUrl: session.url,
        sessionId: session.id,
      });
    } catch (err) {
      console.error("[payments] create-checkout 失敗:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "建立 Checkout Session 失敗",
      });
    }
  });

  /**
   * POST /api/payments/webhook
   * Stripe webhook 接收事件
   *
   * 注意：W10 D1 暫不驗章（後續 D2 補上 stripe-signature 驗證）
   * 目前只記 log 確認 endpoint 可達
   */
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      if (!STRIPE_KEY) {
        return res.status(503).json({ error: "付費系統未啟用" });
      }

      const event = req.body;
      console.log("[payments] webhook 收到:", event?.type ?? "unknown");

      // W10 D2 補上：依 event type 分流
      // - checkout.session.completed → 解鎖付費權限
      // - charge.refunded → 取消權限
      // - invoice.payment_failed → 訂閱失敗

      res.json({ received: true });
    } catch (err) {
      console.error("[payments] webhook 失敗:", err);
      res.status(500).json({ error: "webhook 處理失敗" });
    }
  });

  /**
   * GET /api/payments/health
   * 公開健康檢查（不洩漏 key）
   */
  app.get("/api/payments/health", (_req, res) => {
    res.json({
      status: "ok",
      stripeConfigured: !!STRIPE_KEY,
      timestamp: new Date().toISOString(),
    });
  });
}
