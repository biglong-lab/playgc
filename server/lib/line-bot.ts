// 🤖 LINE Bot — Messaging API 工具（W15 D1）
//
// 文件：https://developers.line.biz/en/reference/messaging-api/
//
// 環境變數：
//   LINE_CHANNEL_SECRET           - 用於 webhook signature 驗證
//   LINE_CHANNEL_ACCESS_TOKEN     - 用於 reply / push API
//
// 設計：用 fetch 直接打 LINE API（與 stripe-checkout / recur-tw 風格一致）

import crypto from "crypto";

const LINE_API_BASE = "https://api.line.me/v2/bot";

export interface LineMessage {
  type: "text" | "image" | "sticker";
  text?: string;
  // image / sticker 等其他欄位 W15 D2+ 補
  originalContentUrl?: string;
  previewImageUrl?: string;
  packageId?: string;
  stickerId?: string;
}

/**
 * 驗證 LINE webhook 簽章
 *
 * LINE 用 HMAC-SHA256 + base64：
 *   X-Line-Signature = base64(hmac_sha256(rawPayload, channelSecret))
 *
 * 用 timingSafeEqual 防 timing attack
 */
export function verifyLineSignature(
  rawPayload: string,
  signature: string | undefined,
  channelSecret: string,
): boolean {
  if (!signature || !channelSecret) return false;
  const expected = crypto
    .createHmac("SHA256", channelSecret)
    .update(rawPayload)
    .digest("base64");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * 回覆訊息（reply token 30 秒內有效）
 *
 * @example
 *   await replyMessage({
 *     accessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
 *     replyToken: event.replyToken,
 *     messages: [{ type: "text", text: "Hello!" }],
 *   });
 */
export async function replyMessage(input: {
  accessToken: string;
  replyToken: string;
  messages: LineMessage[];
}): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken: input.replyToken,
      messages: input.messages,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`LINE reply API 錯誤 (${res.status}): ${errBody.slice(0, 300)}`);
  }
}

/**
 * 推播訊息（不需 reply token、可主動發送）
 *
 * 注意：免費方案每月 1000 則訊息上限
 */
export async function pushMessage(input: {
  accessToken: string;
  to: string; // userId / groupId / roomId
  messages: LineMessage[];
}): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: input.to,
      messages: input.messages,
    }),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`LINE push API 錯誤 (${res.status}): ${errBody.slice(0, 300)}`);
  }
}

/**
 * 解析 LINE webhook event payload
 *
 * 文件：https://developers.line.biz/en/reference/messaging-api/#webhook-event-objects
 */
export interface LineWebhookEvent {
  type: string; // "message" / "follow" / "unfollow" / "postback" / ...
  timestamp: number;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  replyToken?: string;
  message?: {
    id: string;
    type: "text" | "image" | "sticker" | "video" | "audio" | "location";
    text?: string;
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}
