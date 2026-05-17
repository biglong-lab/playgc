// 📣 LINE Pusher — 活動相關推播 helper（W15 D2）
//
// 用途：
//   - 活動建立通知（給玩家 hostUrl + playUrl）
//   - 24h / 1h 前活動提醒
//   - 活動結束推播（回顧連結）
//
// 設計：
//   - fire-and-forget（失敗 log、不阻擋呼叫方）
//   - LINE 免費 1000 訊息/月限制（W15 D2 不做用量追蹤、信任 LINE 後台統計）

import { pushMessage, type LineMessage } from "./line-bot";
import { resolveLineConfig } from "./line-config-resolver";

// 🆕 2026-05-17 per-field：所有 push 函式 input 加 optional fieldId
// 走 resolveLineConfig 先查 field → fallback env、不再硬寫死 process.env

export interface ActivityCreatedPushInput {
  /** 玩家 LINE userId（從 LIFF profile 取得後存）*/
  userId: string;
  /** 顯示名稱 */
  displayName: string;
  /** 活動名稱（如「Hung & Anita 5/15 婚禮」）*/
  activityName: string;
  /** 玩家入口 URL（LIFF 或一般）*/
  playUrl: string;
  /** 活動開始時間（可選，含時間提示）*/
  startsAt?: Date;
  /** 🆕 2026-05-17：場域 ID（per-field LINE channel）*/
  fieldId?: string | null;
}

/**
 * 活動建立後通知玩家（push）
 */
export async function pushActivityCreated(input: ActivityCreatedPushInput): Promise<void> {
  const config = await resolveLineConfig(input.fieldId);
  if (!config.accessToken) {
    console.warn(`[line-pusher] ACCESS_TOKEN 未設（source=${config.source}）、跳過推播`);
    return;
  }

  const startsAtText = input.startsAt
    ? `\n\n🕐 開始時間：${input.startsAt.toLocaleString("zh-TW", { dateStyle: "short", timeStyle: "short" })}`
    : "";

  const messages: LineMessage[] = [
    {
      type: "text",
      text:
        `🎉 ${input.displayName} 您好！\n\n` +
        `「${input.activityName}」已準備好，請點以下連結進入：\n\n` +
        `${input.playUrl}` +
        `${startsAtText}\n\n` +
        `（透過 LINE 點擊可自動帶入您的名字）`,
    },
  ];

  try {
    await pushMessage({ accessToken: config.accessToken, to: input.userId, messages });
  } catch (err) {
    console.error("[line-pusher] activity-created 推播失敗:", err);
  }
}

export interface ActivityReminderPushInput {
  userId: string;
  displayName: string;
  activityName: string;
  playUrl: string;
  /** 提醒類型 */
  remindType: "24h" | "1h";
  /** 🆕 2026-05-17：場域 ID */
  fieldId?: string | null;
}

/**
 * 活動前提醒（24h / 1h 前）
 */
export async function pushActivityReminder(input: ActivityReminderPushInput): Promise<void> {
  const config = await resolveLineConfig(input.fieldId);
  if (!config.accessToken) {
    console.warn(`[line-pusher] ACCESS_TOKEN 未設（source=${config.source}）、跳過推播`);
    return;
  }

  const intro =
    input.remindType === "24h"
      ? `📅 提醒一下、明天「${input.activityName}」就要開始囉！`
      : `⏰ 「${input.activityName}」即將在 1 小時後開始！`;

  const messages: LineMessage[] = [
    {
      type: "text",
      text: `${intro}\n\n${input.displayName}，到時候再用以下連結進入：\n\n${input.playUrl}`,
    },
  ];

  try {
    await pushMessage({ accessToken: config.accessToken, to: input.userId, messages });
  } catch (err) {
    console.error(`[line-pusher] activity-reminder ${input.remindType} 推播失敗:`, err);
  }
}

export interface ActivityEndedPushInput {
  userId: string;
  displayName: string;
  activityName: string;
  /** 回顧網址（可選）*/
  recapUrl?: string;
  /** 自訂結尾話術（可選）*/
  closingMessage?: string;
  /** 🆕 2026-05-17：場域 ID */
  fieldId?: string | null;
}

/**
 * 活動結束推播（含回顧連結）
 */
export async function pushActivityEnded(input: ActivityEndedPushInput): Promise<void> {
  const config = await resolveLineConfig(input.fieldId);
  if (!config.accessToken) {
    console.warn(`[line-pusher] ACCESS_TOKEN 未設（source=${config.source}）、跳過推播`);
    return;
  }

  const recapText = input.recapUrl
    ? `\n\n📸 回顧連結：${input.recapUrl}`
    : "";

  const closing = input.closingMessage || "謝謝您的參與，下次活動再見！";

  const messages: LineMessage[] = [
    {
      type: "text",
      text:
        `🎊 ${input.displayName}，「${input.activityName}」已結束！\n\n` +
        closing +
        recapText,
    },
  ];

  try {
    await pushMessage({ accessToken: config.accessToken, to: input.userId, messages });
  } catch (err) {
    console.error("[line-pusher] activity-ended 推播失敗:", err);
  }
}

/**
 * 廣播給多個 userId（用 for-await 確保有序、避免 LINE rate limit）
 */
export async function broadcastToUsers<T extends { userId: string }>(
  inputs: T[],
  pushFn: (input: T) => Promise<void>,
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;
  for (const input of inputs) {
    try {
      await pushFn(input);
      success++;
    } catch {
      failed++;
    }
    // 簡單 throttle：每則延 100ms（LINE 1000/min limit）
    await new Promise((r) => setTimeout(r, 100));
  }
  return { success, failed };
}
