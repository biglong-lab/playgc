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
import { createRecurCheckoutSession, verifyRecurWebhookSignature } from "../lib/recur-tw";
import { verifyStripeWebhookSignature } from "../lib/webhook-signature";
import { sendEmailAsync, buildPaymentSuccessEmail } from "../lib/resend-mailer";
import { getScenarioById } from "@shared/scenario-templates";

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const RECUR_KEY = process.env.RECUR_TW_API_KEY;
const RECUR_WEBHOOK_SECRET = process.env.RECUR_TW_WEBHOOK_SECRET;
const RESEND_KEY = process.env.RESEND_API_KEY;

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
   * 簽章驗證：STRIPE_WEBHOOK_SECRET 已設定時強制驗 stripe-signature
   * （驗簽對象是 rawBody、不能用 JSON.parse 後的 body 重組）
   */
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      if (!STRIPE_KEY) {
        return res.status(503).json({ error: "付費系統未啟用" });
      }

      if (STRIPE_WEBHOOK_SECRET) {
        const rawPayload =
          req.rawBody instanceof Buffer ? req.rawBody.toString("utf8") : "";
        const sig = req.headers["stripe-signature"] as string | undefined;
        if (!verifyStripeWebhookSignature(rawPayload, sig, STRIPE_WEBHOOK_SECRET)) {
          console.warn("[payments] stripe webhook 簽章未通過、拒絕請求");
          return res.status(401).json({ error: "Invalid signature" });
        }
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
      recurTwConfigured: !!RECUR_KEY,
      recurWebhookConfigured: !!RECUR_WEBHOOK_SECRET,
      resendConfigured: !!RESEND_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // ════════════════════════════════════════════════════════════════════
  // Recur.tw（W10 D2）— 主要付費路徑
  // ════════════════════════════════════════════════════════════════════

  /**
   * POST /api/payments/recur/create-checkout
   * Body: { scenarioId: string, productId: string, mode?: "PAYMENT"|"SUBSCRIPTION", customerEmail?: string }
   *
   * 主要付費入口（取代 Stripe）
   * 公開（不需登入）— 客戶可從 /pricing 直接下單
   *
   * 注意：productId 必須在 Recur.tw 後台先建立
   *       admin 在後台 settings 維護「scenarioId → productId」對應
   */
  app.post("/api/payments/recur/create-checkout", async (req, res) => {
    try {
      if (!RECUR_KEY) {
        return res.status(503).json({
          error: "Recur.tw 付費系統未啟用（RECUR_TW_API_KEY 未設定）",
          code: "RECUR_NOT_CONFIGURED",
        });
      }

      const { scenarioId, mode = "PAYMENT", customerEmail } = req.body ?? {};
      let { productId } = req.body ?? {};
      if (!scenarioId) return res.status(400).json({ error: "缺少 scenarioId" });

      // W10 D3: 若未提供 productId，從環境變數查（依 scenarioId）
      // 環境變數命名：RECUR_PRODUCT_<SCENARIO_ID_UPPER_SNAKE>
      // 例如：RECUR_PRODUCT_WEDDING=prod_xxx
      if (!productId) {
        const envKey = `RECUR_PRODUCT_${scenarioId.toUpperCase().replace(/-/g, "_")}`;
        productId = process.env[envKey];
        if (!productId) {
          return res.status(400).json({
            error: `此情境尚未設定 Recur.tw productId（${envKey} 未設）`,
            code: "RECUR_PRODUCT_NOT_MAPPED",
          });
        }
      }

      const scenario = getScenarioById(scenarioId);
      if (!scenario) return res.status(404).json({ error: "情境不存在" });

      const origin = `${req.protocol}://${req.get("host")}`;

      const session = await createRecurCheckoutSession({
        apiKey: RECUR_KEY,
        mode,
        productId,
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
      console.error("[payments] recur/create-checkout 失敗:", err);
      res.status(500).json({
        error: err instanceof Error ? err.message : "建立 Recur.tw Checkout 失敗",
      });
    }
  });

  /**
   * POST /api/payments/recur/webhook
   * Recur.tw 付費完成 webhook
   *
   * TODO（W10 D5）：
   *   - 驗章 verifyRecurWebhookSignature
   *   - 解析 event type → 解鎖付費權限 / 寄付費通知
   */
  app.post("/api/payments/recur/webhook", async (req, res) => {
    try {
      if (!RECUR_KEY) {
        return res.status(503).json({ error: "Recur.tw 付費系統未啟用" });
      }

      const event = req.body;
      const eventType = event?.type ?? "unknown";
      console.log("[payments] recur webhook 收到:", eventType);

      // 簽章驗證（HMAC SHA-256、verifyRecurWebhookSignature 實作見 lib/recur-tw.ts）
      // 安全：簽章不通過直接阻擋、避免任何人能偽造 checkout.session.completed 觸發發 email
      if (RECUR_WEBHOOK_SECRET) {
        const sig = req.headers["x-recur-signature"] as string | undefined;
        const rawPayload = JSON.stringify(req.body);
        if (!sig || !verifyRecurWebhookSignature(rawPayload, sig, RECUR_WEBHOOK_SECRET)) {
          console.warn("[payments] recur webhook 簽章未通過、拒絕請求");
          return res.status(401).json({ error: "Invalid signature" });
        }
      }

      // checkout.session.completed → 付款成功通知信件（W10 D5）
      if (eventType === "checkout.session.completed" && RESEND_KEY) {
        const customerEmail = event?.data?.customer_email ?? event?.data?.customerEmail;
        const scenarioId = event?.data?.metadata?.scenarioId;
        const scenario = scenarioId ? getScenarioById(scenarioId) : null;

        if (customerEmail && scenario) {
          const { subject, html } = buildPaymentSuccessEmail({
            customerEmail,
            scenarioName: scenario.name,
            amount: event?.data?.amount_total ?? 0,
            instances: [], // 真實場景：應於 webhook 回 instantiate 後再寄
          });
          sendEmailAsync({
            apiKey: RESEND_KEY,
            to: customerEmail,
            subject,
            html,
            tags: [{ name: "type", value: "payment-success" }],
          });
        }
      }

      res.json({ received: true });
    } catch (err) {
      console.error("[payments] recur webhook 失敗:", err);
      res.status(500).json({ error: "webhook 處理失敗" });
    }
  });

  /**
   * GET /api/payments/email/test
   * super_admin 測試信件發送（W10 D5）
   * 不寫進 smoke test（需要實際 RESEND_API_KEY）
   */
  app.get("/api/payments/email/test", async (req, res) => {
    if (!RESEND_KEY) {
      return res.status(503).json({ error: "Resend 未啟用（RESEND_API_KEY 未設定）" });
    }
    const to = req.query.to as string | undefined;
    if (!to) return res.status(400).json({ error: "缺少 ?to=email@example.com" });

    try {
      const { sendEmail } = await import("../lib/resend-mailer");
      const result = await sendEmail({
        apiKey: RESEND_KEY,
        to,
        subject: "✅ CHITO 信件測試",
        html: "<h1>Hello CHITO</h1><p>Resend 信件系統運作正常</p>",
      });
      res.json({ ok: true, id: result.id });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "未知錯誤" });
    }
  });
}
