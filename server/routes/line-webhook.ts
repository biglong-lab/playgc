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
  type LineMessage,
  type LineQuickReply,
} from "../lib/line-bot";
import { resolveLineConfig } from "../lib/line-config-resolver";
import { parseAdminCommand, formatCommandReply } from "../lib/admin-nlu";
import { isLineUserAdmin, getAdminFieldId, getLineAdminStatus } from "../lib/admin-line-auth";
import {
  instantiateScenarioForLine,
  type LineInstantiateResult,
} from "../lib/scenario-instantiator-line";
import {
  listActiveSessionsForLineAdmin,
  endSessionForLineAdmin,
  type ActiveSessionSummary,
} from "../lib/admin-line-actions";

/**
 * W16 D2/D3: Quick Reply 工廠 — admin 常用指令快速按鈕
 *
 * LINE 客戶端在訊息底部顯示按鈕列、點擊送對應文字訊息
 * 最多 13 個 items（LINE 限制）
 *
 * W16 D3 加入「📋 我的活動」管理按鈕
 */
function adminQuickReply(): LineQuickReply {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "📋 我的活動", text: "@chito 我的活動" },
      },
      {
        type: "action",
        action: { type: "message", label: "📖 用法", text: "@chito help" },
      },
      {
        type: "action",
        action: { type: "message", label: "📦 情境", text: "@chito list" },
      },
      {
        type: "action",
        action: { type: "message", label: "💒 婚禮", text: "@chito 婚禮" },
      },
      {
        type: "action",
        action: { type: "message", label: "🎂 生日", text: "@chito 生日派對" },
      },
      {
        type: "action",
        action: { type: "message", label: "❄️ 破冰", text: "@chito 破冰活動" },
      },
      {
        type: "action",
        action: { type: "message", label: "🎓 同學會", text: "@chito 同學會" },
      },
    ],
  };
}

/**
 * W16 D3: active sessions 列表的 reply 訊息
 *
 * 訊息結構：
 *   📋 您的 active 活動（N 個）
 *   1. <gameTitle>
 *      🆔 <sessionId>（前 8 字元）
 *      ⏰ 剩餘 X 小時
 *      🖥 hostUrl
 *   2. ...
 *   💡 結束某場：「@chito 結束 <sessionId>」
 *
 * 場次多時 truncate 至 5 個
 */
function formatActiveSessionsReply(
  sessions: ActiveSessionSummary[],
  baseUrl: string,
): string {
  if (sessions.length === 0) {
    return `📋 您目前沒有 active 活動\n\n💡 試試「@chito 婚禮」建立一個吧！`;
  }

  const lines: string[] = [`📋 您的 active 活動（${sessions.length} 個）`, ``];
  const showCount = Math.min(sessions.length, 5);

  for (let i = 0; i < showCount; i++) {
    const s = sessions[i];
    const remainHours = s.expiresAt
      ? Math.max(0, Math.round((new Date(s.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60)))
      : 0;
    lines.push(`${i + 1}. ${s.gameTitle}`);
    lines.push(`   🆔 ${s.sessionId.slice(0, 8)}`);
    lines.push(`   ⏰ 剩餘 ${remainHours} 小時`);
    lines.push(`   🖥 ${baseUrl}${s.hostUrl}`);
    lines.push(``);
  }

  if (sessions.length > showCount) {
    lines.push(`...（還有 ${sessions.length - showCount} 個，請至 admin 後台查看）`);
    lines.push(``);
  }

  lines.push(`💡 結束某場：「@chito 結束 <sessionId>」`);
  lines.push(`   sessionId 取訊息中前 8 字元即可`);

  return lines.join("\n");
}

/**
 * W16 D3: end_session 的 quick reply（成功後讓 admin 容易繼續操作）
 */
function postEndQuickReply(): LineQuickReply {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "📋 看剩餘活動", text: "@chito 我的活動" },
      },
      {
        type: "action",
        action: { type: "message", label: "💒 再開一場", text: "@chito 婚禮" },
      },
      {
        type: "action",
        action: { type: "message", label: "📖 用法", text: "@chito help" },
      },
    ],
  };
}

/**
 * W16 D2: 建場成功 sticker（LINE 預設貼圖、慶祝氣氛）
 *
 * Package 11537 = LINE Friends（免費官方）
 * Sticker 52002734 = 拍手慶祝
 *
 * 文件：https://developers.line.biz/en/docs/messaging-api/sticker-list/
 */
function celebrationSticker(): LineMessage {
  return {
    type: "sticker",
    packageId: "11537",
    stickerId: "52002734",
  };
}

/**
 * W16 D1: 把多元件 instantiate 結果格式化為 LINE 訊息
 *
 * 訊息結構：
 *   ✅ 建場成功！
 *   📦 情境 / 📝 名稱 / ⏰ 有效期
 *   🖥 主大螢幕（host 第一個）
 *   📱 主玩家網址（host 第一個）
 *   📋 元件清單（最多顯示 5 個，超過 truncate）
 *
 * LINE text message 上限 5000 字、多元件 truncate 至 5 個避免超限
 */
function formatInstantiateReply(result: LineInstantiateResult, baseUrl: string): string {
  const lines: string[] = [
    `✅ 建場成功！`,
    ``,
    `📦 情境：${result.scenarioName}`,
    `📝 名稱：${result.displayName}`,
    `⏰ 有效期：12 小時`,
    `🎮 元件數：${result.instances.length}`,
    ``,
  ];

  if (result.primaryHostUrl) {
    lines.push(`🖥 大螢幕網址（請投影）：`);
    lines.push(`${baseUrl}${result.primaryHostUrl}`);
    lines.push(``);
  }
  if (result.primaryPlayUrl) {
    lines.push(`📱 玩家網址（QR 給來賓掃）：`);
    lines.push(`${baseUrl}${result.primaryPlayUrl}`);
    lines.push(``);
  }
  if (result.primaryGameUrl) {
    lines.push(`🎯 主玩家入口：`);
    lines.push(`${baseUrl}${result.primaryGameUrl}`);
    lines.push(``);
  }

  // 元件清單（最多 5 個、超過 truncate）
  const showCount = Math.min(result.instances.length, 5);
  if (result.instances.length > 1) {
    lines.push(`📋 元件清單：`);
    for (let i = 0; i < showCount; i++) {
      const inst = result.instances[i];
      const url = inst.hostUrl || inst.gameUrl || "";
      const axisIcon =
        inst.axis === "host" ? "🖥" : inst.axis === "multi" ? "👥" : inst.axis === "solo" ? "🎮" : "🔗";
      lines.push(`${axisIcon} ${inst.label}`);
      if (url) lines.push(`   ${baseUrl}${url}`);
    }
    if (result.instances.length > showCount) {
      lines.push(`...（還有 ${result.instances.length - showCount} 個元件，請至 admin 後台查看）`);
    }
  }

  return lines.join("\n");
}

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

  // 🆕 2026-05-17 per-field webhook：依 URL 中的 fieldKey 取對應 channel secret/token
  // 業主在 LINE Console 設 https://game.homi.cc/api/webhooks/line/JIACHUN
  // 簽章驗證 + 回 200（讓 LINE Console 通過驗證）
  // event handler 暫直接 reply echo、完整 NLU/admin 邏輯後續對齊舊 handler
  app.post(
    "/api/webhooks/line/:fieldKey",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      try {
        const fieldKey = req.params.fieldKey;
        const config = await resolveLineConfig(fieldKey);
        if (!config.channelSecret || !config.accessToken) {
          console.warn(`[line-webhook per-field] ${fieldKey} 未設定（source=${config.source}）`);
          return res.status(503).json({
            error: "LINE channel 未設定",
            fieldKey,
            source: config.source,
          });
        }

        const rawPayload = req.body instanceof Buffer ? req.body.toString("utf8") : "";
        const signature = req.headers["x-line-signature"] as string | undefined;

        // LINE Console「Verify」按鈕送空 body 但有簽章 → 應該回 200
        if (!rawPayload || rawPayload === "{}" || rawPayload === '{"events":[]}') {
          return res.json({ ok: true, eventCount: 0, verified: true });
        }

        if (!verifyLineSignature(rawPayload, signature, config.channelSecret)) {
          console.warn(`[line-webhook per-field] ${fieldKey} 簽章驗證失敗`);
          return res.status(401).json({ error: "Invalid signature" });
        }

        const payload = JSON.parse(rawPayload) as LineWebhookBody;

        // 處理每個 event（fire-and-forget）
        for (const event of payload.events) {
          // 暫用舊 handleEvent（會用 module-level ACCESS_TOKEN）
          // 後續 task 完整重構 handler 接 fieldKey
          handleEvent(event).catch((err) => {
            console.error(`[line-webhook per-field ${fieldKey}] event handle 失敗:`, err);
          });
        }

        res.json({ ok: true, eventCount: payload.events.length, fieldKey });
      } catch (err) {
        console.error("[line-webhook per-field] 處理失敗:", err);
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
// ============================================================================
// Rich Menu postback dispatcher（W3 D5 — 2026-05-08）
// ============================================================================
async function handleRichMenuPostback(event: LineWebhookEvent): Promise<void> {
  if (!ACCESS_TOKEN || !event.replyToken || !event.postback?.data) return;
  const data = event.postback.data;
  const params = new URLSearchParams(data);
  const action = params.get("action");
  const lineUserId = event.source?.userId;
  const replyToken = event.replyToken;

  switch (action) {
    case "booking_book": {
      // 引導到預約頁（LIFF 內開啟最佳體驗）
      const url = `${APP_BASE_URL}/book/jiacun`;
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: `📅 開始預約\n\n點此選擇日期 / 時段：\n${url}`,
          },
        ],
      });
      return;
    }
    case "battle_register": {
      // 引導到水彈對戰中心
      const url = `${APP_BASE_URL}/battle`;
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text:
              `🎯 水彈對戰報名\n\n` +
              `點此查看開放場次：\n${url}\n\n` +
              `（個人散客 / 預組隊伍 / Squad 戰隊均可報名）`,
          },
        ],
      });
      return;
    }
    case "booking_my": {
      const url = `${APP_BASE_URL}/book/jiacun/mine`;
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: `🎫 您的所有預約：\n${url}`,
          },
        ],
      });
      return;
    }
    case "game_start": {
      // 重用既有 buildGameStartReply（找最近預約 → reply 遊戲連結）
      try {
        const { buildGameStartReply } = await import("../booking/booking-notifier");
        const result = lineUserId ? await buildGameStartReply(lineUserId) : null;
        if (result) {
          await replyMessage({
            accessToken: ACCESS_TOKEN,
            replyToken,
            messages: result.messages,
          });
          return;
        }
      } catch (err) {
        console.error("[richmenu] game_start dispatcher 失敗:", err);
      }
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: "🤔 找不到您近期的預約。\n\n請先完成預約、活動開始時再點此按鈕。",
          },
        ],
      });
      return;
    }
    case "points_my": {
      // Phase β 才實作 — 暫時 placeholder
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: "⭐ 點數系統建置中、敬請期待！\n\n玩遊戲就能累積、未來可兌換金門好康券 🎁",
          },
        ],
      });
      return;
    }
    case "coupons_my": {
      // 第一期跳到 coupon 平台首頁
      const url = "https://coupon.aihomi.cc/";
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: `🎁 您的優惠券：\n${url}`,
          },
        ],
      });
      return;
    }
    case "help": {
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text:
              "❓ 客服 / 說明\n\n" +
              "・問預約：「我的預約」\n" +
              "・現場開始：「開始遊戲」\n" +
              "・其他問題請直接傳訊息、客服將盡快回覆",
          },
        ],
      });
      return;
    }
    default: {
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: `🤔 未知按鈕：${action}\n請點選底部選單其他功能`,
          },
        ],
      });
    }
  }
}

async function handleEvent(event: LineWebhookEvent): Promise<void> {
  if (!ACCESS_TOKEN) return;

  // ✨ 2026-05-08：rich menu postback dispatcher（W3 D5）
  if (event.type === "postback" && event.replyToken && event.postback?.data) {
    await handleRichMenuPostback(event);
    return;
  }

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
        const text = formatInstantiateReply(result, APP_BASE_URL);
        // W16 D2: sticker 慶祝 + text + quick reply 按鈕
        // LINE reply 一次最多 5 訊息、用 sticker + text 兩則
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            celebrationSticker(),
            {
              type: "text",
              text,
              quickReply: adminQuickReply(),
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
              quickReply: adminQuickReply(),
            },
          ],
        });
      }
      return;
    }

    // W16 D3: list_active → 列出 admin 場域 active sessions
    if (cmd.intent === "list_active") {
      const result = await listActiveSessionsForLineAdmin(lineUserId);
      if (!result.ok) {
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            {
              type: "text",
              text: `❌ ${result.error}（請先聯繫平台管理員加入 admin 白名單）`,
            },
          ],
        });
        return;
      }
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text: formatActiveSessionsReply(result.sessions, APP_BASE_URL),
            quickReply: adminQuickReply(),
          },
        ],
      });
      return;
    }

    // W16 D3: end_session → 結束指定 session
    if (cmd.intent === "end_session" && cmd.sessionId) {
      // 支援前 8 字元 → 從 active list 找完整 sessionId
      let fullSessionId = cmd.sessionId;
      if (cmd.sessionId.length < 30) {
        const list = await listActiveSessionsForLineAdmin(lineUserId);
        if (list.ok) {
          const matched = list.sessions.find((s) =>
            s.sessionId.startsWith(cmd.sessionId!),
          );
          if (matched) fullSessionId = matched.sessionId;
        }
      }
      const result = await endSessionForLineAdmin({
        lineUserId,
        sessionId: fullSessionId,
      });
      if (!result.ok) {
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: [
            {
              type: "text",
              text: `❌ 結束失敗：${result.error}`,
              quickReply: adminQuickReply(),
            },
          ],
        });
        return;
      }
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text:
              `✅ session 已結束\n\n` +
              `🆔 ${fullSessionId.slice(0, 8)}\n` +
              `📊 webhook 已派發 instance.expired（如有設定）`,
            quickReply: postEndQuickReply(),
          },
        ],
      });
      return;
    }

    // help / list / unknown → 回 NLU 預覽 + quick reply
    await replyMessage({
      accessToken: ACCESS_TOKEN,
      replyToken,
      messages: [
        {
          type: "text",
          text: formatCommandReply(cmd),
          quickReply: adminQuickReply(),
        },
      ],
    });
    return;
  }

  // 一般訊息：先 dispatcher 試各關鍵字、未命中再 echo
  const lineUserId = event.source?.userId;

  // 📅 預約系統關鍵字：「開始遊戲」「我要玩」「玩遊戲」「來玩」
  //    用 reply（不扣 quota）回玩家、含遊戲連結
  if (lineUserId && /(開始遊戲|我要玩|玩遊戲|來玩|start game)/i.test(text)) {
    try {
      const { buildGameStartReply } = await import("../booking/booking-notifier");
      const result = await buildGameStartReply(lineUserId);
      if (result) {
        await replyMessage({
          accessToken: ACCESS_TOKEN,
          replyToken,
          messages: result.messages,
        });
        return;
      }
      // 沒找到近期預約 → 提醒先預約
      await replyMessage({
        accessToken: ACCESS_TOKEN,
        replyToken,
        messages: [
          {
            type: "text",
            text:
              "🤔 找不到您近期的預約。\n\n" +
              "請先預約場次、活動開始時再傳「開始遊戲」喔！",
          },
        ],
      });
      return;
    } catch (err) {
      console.error("[line-webhook] game start dispatcher 失敗:", err);
      // fall through to echo
    }
  }

  // 預設 echo + admin quick reply
  const isAdmin = isLineUserAdmin(lineUserId);
  await replyMessage({
    accessToken: ACCESS_TOKEN,
    replyToken,
    messages: [
      {
        type: "text",
        text: `您說：${text}\n\n💡 試試「@chito help」看 admin 指令用法`,
        // 只給 admin 顯示 quick reply（一般用戶看到會困惑）
        ...(isAdmin ? { quickReply: adminQuickReply() } : {}),
      },
    ],
  });
}
