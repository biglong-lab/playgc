// 🤖 LINE Webhook receiver（W15 D1）
//
// 端點：
//   POST /api/webhooks/line   接收 LINE Bot events
//   GET  /api/webhooks/line/health   公開健康檢查
//
// 設計：
//   - 必須驗證 X-Line-Signature（防偽造）
//   - 預設 echo bot：「您說：xxx」
//   - W15 D2-D3 加入 NLU + admin 文字建場
//
// 環境變數：
//   LINE_CHANNEL_SECRET           - 簽章驗證
//   LINE_CHANNEL_ACCESS_TOKEN     - reply / push API

import type { Express, Request, Response } from "express";
import express from "express";
import {
  verifyLineSignature,
  replyMessage,
  type LineWebhookBody,
  type LineWebhookEvent,
} from "../lib/line-bot";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

export function registerLineWebhookRoutes(app: Express) {
  /**
   * GET /api/webhooks/line/health
   * 公開健康檢查（不洩漏 secret）
   */
  app.get("/api/webhooks/line/health", (_req, res) => {
    res.json({
      status: "ok",
      lineBotConfigured: !!(CHANNEL_SECRET && ACCESS_TOKEN),
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/webhooks/line
   * LINE Bot 事件接收
   *
   * 驗證流程：
   *   1. 取 raw body（簽章用）
   *   2. 驗證 X-Line-Signature
   *   3. 解析 events
   *   4. 處理（W15 D1 預設 echo / 後續加 NLU）
   */
  app.post(
    "/api/webhooks/line",
    // 用 raw 解析 body（簽章驗證需要）
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      try {
        if (!CHANNEL_SECRET || !ACCESS_TOKEN) {
          return res.status(503).json({
            error: "LINE Bot 未設定（LINE_CHANNEL_SECRET / LINE_CHANNEL_ACCESS_TOKEN 缺）",
            code: "LINE_BOT_NOT_CONFIGURED",
          });
        }

        const rawPayload = req.body instanceof Buffer ? req.body.toString("utf8") : "";
        const signature = req.headers["x-line-signature"] as string | undefined;

        // 驗證簽章（紅線）
        if (!verifyLineSignature(rawPayload, signature, CHANNEL_SECRET)) {
          console.warn("[line-webhook] 簽章驗證失敗");
          return res.status(401).json({ error: "Invalid signature" });
        }

        const payload = JSON.parse(rawPayload) as LineWebhookBody;

        // 處理每個 event（fire-and-forget，不阻擋 LINE）
        for (const event of payload.events) {
          handleEvent(event).catch((err) => {
            console.error("[line-webhook] event handle 失敗:", err);
          });
        }

        // LINE 期望立即回 200（< 5 秒）
        res.json({ ok: true, eventCount: payload.events.length });
      } catch (err) {
        console.error("[line-webhook] 處理失敗:", err);
        res.status(500).json({ error: "webhook 處理失敗" });
      }
    },
  );
}

/**
 * 處理單一 LINE event
 *
 * W15 D1：預設 echo bot
 * W15 D3：加 admin NLU（@chito 婚禮 → 建場）
 */
async function handleEvent(event: LineWebhookEvent): Promise<void> {
  if (!ACCESS_TOKEN) return;

  // 目前只處理 text message
  if (event.type !== "message" || event.message?.type !== "text") {
    console.log(`[line-webhook] 略過 ${event.type} event`);
    return;
  }

  const text = event.message.text || "";
  const replyToken = event.replyToken;
  if (!replyToken) return;

  // W15 D1 預設 echo bot
  await replyMessage({
    accessToken: ACCESS_TOKEN,
    replyToken,
    messages: [
      {
        type: "text",
        text: `您說：${text}\n\n（W15 D1 echo mode、後續加入 admin 文字建場 + 玩家報名）`,
      },
    ],
  });
}
