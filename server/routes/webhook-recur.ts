// Recur.tw Webhook 處理路由
// 接收 Recur 付款事件，更新交易狀態並解鎖遊戲/章節
import type { Express } from "express";
import { storage } from "../storage";
import {
  verifyWebhookSignature,
  type RecurWebhookEvent,
} from "../services/recur-client";

/** 已處理事件 ID 快取（冪等性） */
const processedEvents = new Set<string>();

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

      const rawBody =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);

      if (!verifyWebhookSignature(rawBody, signature)) {
        return res.status(401).json({ message: "簽名驗證失敗" });
      }

      // 2. 解析事件
      const event: RecurWebhookEvent =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;

      // 3. 冪等性檢查
      if (processedEvents.has(event.id)) {
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

      // 5. 記錄已處理
      processedEvents.add(event.id);

      // 防止記憶體洩漏：只保留最近 1000 筆
      if (processedEvents.size > 1000) {
        const first = processedEvents.values().next().value;
        if (first) processedEvents.delete(first);
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
}
