// 🤖 LINE Bot — Messaging API 工具（W15 D1）
//
// 文件：https://developers.line.biz/en/reference/messaging-api/
//
// 環境變數：
//   LINE_CHANNEL_SECRET           - 用於 webhook signature 驗證
//   LINE_CHANNEL_ACCESS_TOKEN     - 用於 reply / push API
//
// 設計：用 fetch 直接打 LINE API（與 stripe-checkout / recur-tw 風格一致）

import { verifyHmacSignature } from "./webhook-signature";

const LINE_API_BASE = "https://api.line.me/v2/bot";

/**
 * Quick Reply Action（W16 D2）
 * 文件：https://developers.line.biz/en/docs/messaging-api/using-quick-reply/
 *
 * - message：點擊後送出文字訊息（最常用）
 * - uri：點擊開啟 URL
 * - postback：點擊送 postback event（W16 D3+ 用）
 */
export interface LineQuickReplyItem {
  type: "action";
  action:
    | { type: "message"; label: string; text: string }
    | { type: "uri"; label: string; uri: string }
    | { type: "postback"; label: string; data: string; displayText?: string };
  /** 可選 icon URL */
  imageUrl?: string;
}

/**
 * Quick Reply 容器（最多 13 個 items）
 * 附在 message 上、用戶看到底部按鈕列
 */
export interface LineQuickReply {
  items: LineQuickReplyItem[];
}

/**
 * LINE Message（W15 D1 → W16 D2 加 quickReply）
 *
 * 文件：https://developers.line.biz/en/reference/messaging-api/#message-objects
 */
export interface LineMessage {
  type: "text" | "image" | "sticker" | "flex";
  text?: string;
  originalContentUrl?: string;
  previewImageUrl?: string;
  packageId?: string;
  stickerId?: string;
  /** W16 D2: quick reply buttons（最多 13 個） */
  quickReply?: LineQuickReply;
  /** Flex Message altText（type=flex 必填）*/
  altText?: string;
  /** Flex Message bubble / carousel contents（type=flex 必填）*/
  contents?: Record<string, unknown>;
}

/**
 * 驗證 LINE webhook 簽章
 *
 * LINE 用 HMAC-SHA256 + base64：
 *   X-Line-Signature = base64(hmac_sha256(rawPayload, channelSecret))
 *
 * 內部用 shared verifyHmacSignature（base64 encoding）統一安全姿態
 */
export function verifyLineSignature(
  rawPayload: string,
  signature: string | undefined,
  channelSecret: string,
): boolean {
  return verifyHmacSignature(rawPayload, signature, channelSecret, "base64");
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
  /** postback event payload（rich menu / quick reply 點擊）*/
  postback?: {
    data: string;
    params?: Record<string, string>;
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineWebhookEvent[];
}
