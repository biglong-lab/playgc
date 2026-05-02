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
import { parseAdminCommand, formatCommandReply } from "../lib/admin-nlu";
import { isLineUserAdmin, getAdminFieldId, getLineAdminStatus } from "../lib/admin-line-auth";
import { instantiateScenarioForLine } from "../lib/scenario-instantiator-line";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const APP_BASE_URL = process.env.APP_BASE_URL || "https://game.homi.cc";

export function registerLineWebhookRoutes(app: Express) {
  /**
   * GET /api/webhooks/line/health
   * 公開健康檢查（不洩漏 secret）
   */
  app.get("/api/webhooks/line/health", (_req, res) => {
    const adminStatus = getLineAdminStatus();
    res.json({
      status: "ok",
      lineBotConfigured: !!(CHANNEL_SECRET && ACCESS_TOKEN),
      nluConfigured: !!OPENROUTER_KEY,
      adminConfigured: adminStatus.configured,
      adminCount: adminStatus.adminCount,
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

  // W15 D3-D5: 偵測 @chito 指令 → 走 NLU + admin 認證 → 真建場
  if (/^@chito\b/i.test(text)) {
    if (!OPENROUTER_KEY) {
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: "🚧 admin 指令模式未啟用（OPENROUTER_API_KEY 未設定）",
          },
        ],
      });
      return;
    }

    const cmd = await parseAdminCommand({ apiKey: OPENROUTER_KEY, text });

    // W15 D5: admin 認證 + create_scenario → 真建場
    const lineUserId = event.source?.userId;
    const isAdmin = isLineUserAdmin(lineUserId);

    if (cmd.intent === "create_scenario" && cmd.scenarioId) {
      if (!isAdmin) {
        // 非 admin → 回 NLU 預覽 + 提示需 admin 設定
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            {
              type: "text",
              text:
                `${formatCommandReply(cmd)}\n\n` +
                `⚠️ 您非 admin、無法直接建場。\n` +
                `請聯繫平台管理員將您的 LINE userId（${lineUserId?.slice(0, 8)}...）加入白名單。`,
            },
          ],
        });
        return;
      }

      // admin → 真建場
      const fieldId = getAdminFieldId(lineUserId);
      const result = await instantiateScenarioForLine({
        scenarioId: cmd.scenarioId,
        displayName: cmd.displayName || cmd.scenarioId,
        fieldId,
      });

      if (result.ok) {
        const fullHostUrl = `${APP_BASE_URL}${result.hostUrl}`;
        const fullPlayUrl = `${APP_BASE_URL}${result.playUrl}`;
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            {
              type: "text",
              text:
                `✅ 建場成功！\n\n` +
                `📦 情境：${result.scenarioName}\n` +
                `📝 名稱：${result.displayName}\n` +
                `⏰ 有效期：12 小時\n\n` +
                `🖥 大螢幕網址（請投影）：\n${fullHostUrl}\n\n` +
                `📱 玩家網址（QR 給來賓掃）：\n${fullPlayUrl}`,
            },
          ],
        });
      } else {
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            {
              type: "text",
              text: `❌ 建場失敗：${result.error}\n\n${formatCommandReply(cmd)}`,
            },
          ],
        });
      }
      return;
    }

    // help / list / unknown → 回 NLU 預覽
    await replyMessage({
      accessToken: ACCESS_TOKEN,
      replyToken,
      messages: [{ type: "text", text: formatCommandReply(cmd) }],
    });
    return;
  }

  // 一般訊息：echo bot（W15 D1 行為保留）
  await replyMessage({
    accessToken: ACCESS_TOKEN,
    replyToken,
    messages: [
      {
        type: "text",
        text: `您說：${text}\n\n💡 試試「@chito help」看 admin 指令用法`,
      },
    ],
  });
}
