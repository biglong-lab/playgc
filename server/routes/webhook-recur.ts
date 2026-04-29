// Recur.tw Webhook 處理路由
// 接收 Recur 付款事件，更新交易狀態並解鎖遊戲/章節
import type { Express } from "express";
import { storage } from "../storage";
import {
  verifyWebhookSignature,
  type RecurWebhookEvent,
} from "../services/recur-client";
import { incrementUsage, recordTransactionFee } from "../services/billing";
import { db } from "../db";
import { sql } from "drizzle-orm";

// 🔒 跨 container 冪等性：用 PostgreSQL 的 unique constraint 保證每個 event_id 只處理一次
// 表會自動建立（idempotent CREATE TABLE IF NOT EXISTS）
let webhookTableEnsured = false;
async function ensureWebhookEventsTable(): Promise<void> {
  if (webhookTableEnsured) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS webhook_processed_events (
      event_id varchar PRIMARY KEY,
      source varchar(20) NOT NULL DEFAULT 'recur',
      processed_at timestamp DEFAULT now()
    )
  `);
  // 自動清理 30 天前的舊紀錄（防止表無限長大）
  await db.execute(sql`
    DELETE FROM webhook_processed_events
    WHERE processed_at < now() - interval '30 days'
  `).catch(() => {/* 清理失敗不影響主流程 */});
  webhookTableEnsured = true;
}

/**
 * 嘗試標記 event 為「已處理」
 * 回傳 true = 首次處理（可繼續）；false = 已處理過（duplicate）
 */
async function markEventProcessed(eventId: string): Promise<boolean> {
  await ensureWebhookEventsTable();
  try {
    const result = await db.execute(sql`
      INSERT INTO webhook_processed_events (event_id, source)
      VALUES (${eventId}, 'recur')
      ON CONFLICT (event_id) DO NOTHING
      RETURNING event_id
    `);
    return (result.rows?.length ?? 0) > 0;
  } catch (error) {
    console.error("[webhook-recur] markEventProcessed 失敗:", error);
    // DB 失敗時 fail-open（允許處理，避免漏付款）
    return true;
  }
}

export function registerRecurWebhookRoutes(app: Express) {
  /**
   * Recur Webhook 端點
   * 不需要 auth middleware（Recur 伺服器呼叫）
   * 透過 X-Recur-Signature 驗證來源
   */
  app.post("/api/webhooks/recur", async (req, res) => {
    try {
      // 1. 驗證簽名
      const signature = req.headers["x-recur-signature"] as string;
      if (!signature) {
        return res.status(401).json({ message: "缺少簽名" });
      }

      // 使用 express.json verify 回呼捕獲的原始 Buffer（server/index.ts）
      const rawBody = (req.rawBody as Buffer).toString("utf-8");

      if (!verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ message: "簽名驗證失敗" });
      }

      // 2. 解析事件（express.json() 已解析 body）
      const event: RecurWebhookEvent = req.body;

      // 3. 🔒 跨 container 冪等性檢查（DB INSERT ... ON CONFLICT）
      // 在處理前 mark，確保多個 container 同時收到同一 event 時，只有一個會處理
      const isFirstProcess = await markEventProcessed(event.id);
      if (!isFirstProcess) {
        return res.json({ received: true, duplicate: true });
      }

      // 4. 處理事件
      switch (event.type) {
        case "checkout.completed":
          await handleCheckoutCompleted(event);
          break;
        case "order.paid":
          await handleOrderPaid(event);
          break;
        default:
          // 不處理的事件類型，直接回 200
          break;
      }

      res.json({ received: true });
    } catch (error) {
      // Webhook 必須在 20 秒內回 2xx，否則 Recur 會重試
      // 即使處理失敗也回 200，但記錄錯誤
      res.status(200).json({ received: true, error: "processing_failed" });
    }
  });
}

/** 處理 checkout.completed 事件 */
async function handleCheckoutCompleted(event: RecurWebhookEvent) {
  const data = event.data;
  const checkoutSessionId = data.checkout_session_id as string | undefined;
  if (!checkoutSessionId) return;

  // 從 metadata 取得內部交易 ID
  const metadata = data.metadata as Record<string, string> | undefined;
  const transactionId = metadata?.transactionId;

  if (!transactionId) {
    // 嘗試用 checkout session ID 查找
    const tx = await storage.getTransactionByRecurSession(checkoutSessionId);
    if (tx) {
      await completeTransaction(tx.id, event);
    }
    return;
  }

  await completeTransaction(transactionId, event);
}

/** 處理 order.paid 事件 */
async function handleOrderPaid(event: RecurWebhookEvent) {
  const data = event.data;
  const metadata = data.metadata as Record<string, string> | undefined;
  const transactionId = metadata?.transactionId;

  if (!transactionId) return;
  await completeTransaction(transactionId, event);
}

/** 完成交易：更新 transaction + 建立 purchase + 解鎖遊戲/章節 */
async function completeTransaction(
  transactionId: string,
  event: RecurWebhookEvent,
) {
  const tx = await storage.getTransaction(transactionId);
  if (!tx || tx.status === "completed") return;

  // 更新 transaction 狀態
  await storage.updateTransaction(transactionId, {
    status: "completed",
    recurPaymentId: (event.data.payment_id as string) ?? undefined,
    recurRawResponse: event.data,
  });

  // 建立購買記錄
  await storage.createPurchase({
    userId: tx.userId,
    gameId: tx.gameId,
    chapterId: tx.chapterId ?? undefined,
    purchaseType: "online_payment",
    amount: tx.amount,
    currency: tx.currency ?? "TWD",
    status: "completed",
    transactionId: tx.id,
    completedAt: new Date(),
  });

  // SaaS 計費 hook：用量計量 + 平台抽成（付款成功後才觸發）
  try {
    const game = await storage.getGame(tx.gameId);
    const fieldId = game?.fieldId;
    if (fieldId) {
      await incrementUsage(fieldId, "checkouts", 1);
      await recordTransactionFee({
        fieldId,
        sourceTransactionId: tx.id,
        sourceAmount: tx.amount,
        description: `購買遊戲 ${game?.title ?? tx.gameId}${tx.chapterId ? ` 章節 ${tx.chapterId}` : ""}`,
      });
    }
  } catch (err) {
    // 計費失敗不影響主流程（購買已完成）
    console.error("[billing hook] incrementUsage/recordTransactionFee 失敗:", err);
  }
}
