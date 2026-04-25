// 通知派發 service — 統一發送邏輯
//
// 5 種 channel:
//   - in_app（站內，寫 battle_notifications 或 future inbox）
//   - email（Resend / SMTP）
//   - line_notify（LINE Notify token）
//   - line_oa（LINE Official Account push API）
//   - discord_webhook / social_webhook（通用 webhook）
//
// 設計：
//   - 失敗不阻擋（fire-and-forget）
//   - 寫入 notification_events 紀錄
//   - 自動防重複（dedupeKey + cooldown）
//   - admin 設定哪些事件要發、哪些 channel
//
import { db } from "../db";
import {
  notificationChannels,
  notificationEvents,
  fieldEngagementSettings,
} from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";

// ============================================================================
// Types
// ============================================================================

export interface NotifyOptions {
  fieldId: string;
  squadId?: string;
  userId?: string;
  eventType: string;            // 'first_game' / 'tier_upgrade' / ...
  payload: {
    title: string;
    body: string;
    deepLink?: string;
    imageUrl?: string;
    [key: string]: unknown;
  };
  /** 防重複用，相同 dedupeKey 在 cooldown 內不重發 */
  dedupeKey?: string;
}

export interface DispatchResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  details: Array<{ channelType: string; status: "sent" | "failed" | "skipped"; error?: string }>;
}

// ============================================================================
// 主入口
// ============================================================================

/**
 * 派發通知到所有啟用的 channel
 *
 * 流程：
 *   1. 查場域設定（哪些事件要發、哪些 channel）
 *   2. 防重複檢查（dedupeKey + cooldown）
 *   3. 取啟用的 channels
 *   4. 各 channel 並行發送
 *   5. 寫入 notification_events 紀錄
 */
export async function dispatchNotification(opts: NotifyOptions): Promise<DispatchResult> {
  const result: DispatchResult = {
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    details: [],
  };

  try {
    // 1. 取場域設定
    const [settings] = await db
      .select()
      .from(fieldEngagementSettings)
      .where(eq(fieldEngagementSettings.fieldId, opts.fieldId));

    // 沒設定 → 用預設（全部開啟，但只 in_app）
    const enabledTypes = (settings?.notificationChannels as string[] | undefined) ?? ["in_app"];
    const eventEnabled = checkEventEnabled(opts.eventType, settings);
    if (!eventEnabled) {
      result.skippedCount++;
      result.details.push({ channelType: "all", status: "skipped", error: "event 未啟用" });
      return result;
    }

    // 2. 防重複檢查
    if (opts.dedupeKey) {
      const cooldownHours = settings?.notificationCooldownHours ?? 24;
      const cutoff = new Date();
      cutoff.setHours(cutoff.getHours() - cooldownHours);

      const [existing] = await db
        .select()
        .from(notificationEvents)
        .where(
          and(
            eq(notificationEvents.dedupeKey, opts.dedupeKey),
            gte(notificationEvents.createdAt, cutoff),
          ),
        )
        .orderBy(desc(notificationEvents.createdAt))
        .limit(1);

      if (existing && existing.status === "sent") {
        result.skippedCount++;
        result.details.push({
          channelType: "all",
          status: "skipped",
          error: `dedupeKey ${opts.dedupeKey} 在冷卻期內`,
        });
        return result;
      }
    }

    // 3. 取啟用的 channels
    const channels = await db
      .select()
      .from(notificationChannels)
      .where(
        and(
          eq(notificationChannels.fieldId, opts.fieldId),
          eq(notificationChannels.isActive, true),
        ),
      );

    // in_app 不需 channel record（直接寫到 events 表標記）
    const inAppEnabled = enabledTypes.includes("in_app");
    if (inAppEnabled) {
      try {
        await writeInAppNotification(opts);
        result.successCount++;
        result.details.push({ channelType: "in_app", status: "sent" });
      } catch (err) {
        result.failedCount++;
        result.details.push({
          channelType: "in_app",
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 4. 各 external channel 並行發
    const externalChannels = channels.filter((c) =>
      enabledTypes.includes(c.channelType),
    );

    await Promise.allSettled(
      externalChannels.map(async (channel) => {
        try {
          await sendToChannel(channel, opts);
          result.successCount++;
          result.details.push({ channelType: channel.channelType, status: "sent" });

          // 更新 channel 統計
          await db
            .update(notificationChannels)
            .set({
              sentCount: (channel.sentCount ?? 0) + 1,
              lastSentAt: new Date(),
            })
            .where(eq(notificationChannels.id, channel.id));
        } catch (err) {
          result.failedCount++;
          const errMsg = err instanceof Error ? err.message : String(err);
          result.details.push({
            channelType: channel.channelType,
            status: "failed",
            error: errMsg,
          });

          // 更新 channel 失敗統計
          await db
            .update(notificationChannels)
            .set({
              failedCount: (channel.failedCount ?? 0) + 1,
              lastErrorMessage: errMsg.slice(0, 500),
            })
            .where(eq(notificationChannels.id, channel.id));
        }
      }),
    );
  } catch (err) {
    console.error("[notification-dispatcher] 整體失敗:", err);
    result.failedCount++;
  }

  return result;
}

// ============================================================================
// 各 channel 發送邏輯
// ============================================================================

interface ChannelRow {
  id: string;
  fieldId: string;
  channelType: string;
  config: unknown;
  sentCount: number | null;
  failedCount: number | null;
  lastSentAt: Date | null;
  lastErrorMessage: string | null;
}

async function sendToChannel(channel: ChannelRow, opts: NotifyOptions): Promise<void> {
  const config = (channel.config as Record<string, unknown>) ?? {};
  switch (channel.channelType) {
    case "line_notify":
      await sendLineNotify(config, opts);
      break;
    case "line_oa":
      await sendLineOa(config, opts);
      break;
    case "discord_webhook":
      await sendDiscordWebhook(config, opts);
      break;
    case "social_webhook":
      await sendGenericWebhook(config, opts);
      break;
    case "email":
      await sendEmail(config, opts);
      break;
    default:
      throw new Error(`未支援的 channel type: ${channel.channelType}`);
  }

  // 寫入 events 紀錄
  await db.insert(notificationEvents).values({
    fieldId: opts.fieldId,
    squadId: opts.squadId,
    userId: opts.userId,
    eventType: opts.eventType,
    channelType: channel.channelType,
    status: "sent",
    payload: opts.payload as unknown as Record<string, unknown>,
    dedupeKey: opts.dedupeKey,
    sentAt: new Date(),
  });
}

// ============================================================================
// LINE Notify
// ============================================================================
async function sendLineNotify(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  const token = config.token as string | undefined;
  if (!token) throw new Error("LINE Notify token 未設定");

  const { buildLineNotifyMessage } = await import("./notification-payload-builder");
  const message = buildLineNotifyMessage(opts.payload);

  const params = new URLSearchParams();
  params.append("message", message);
  if (opts.payload.imageUrl) {
    params.append("imageThumbnail", opts.payload.imageUrl as string);
    params.append("imageFullsize", opts.payload.imageUrl as string);
  }

  const res = await fetch("https://notify-api.line.me/api/notify", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  if (!res.ok) {
    throw new Error(`LINE Notify ${res.status}: ${await res.text()}`);
  }
}

// ============================================================================
// LINE Official Account（Messaging API）
// ============================================================================
async function sendLineOa(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  const token = config.channelAccessToken as string | undefined;
  const targetId = (config.targetGroupId ?? config.targetUserId) as string | undefined;
  if (!token) throw new Error("LINE OA channelAccessToken 未設定");
  if (!targetId) throw new Error("LINE OA target 未設定");

  const message = {
    type: "text",
    text: `[${opts.payload.title}]\n${opts.payload.body}${opts.payload.deepLink ? "\n" + opts.payload.deepLink : ""}`,
  };

  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: targetId, messages: [message] }),
  });

  if (!res.ok) {
    throw new Error(`LINE OA ${res.status}: ${await res.text()}`);
  }
}

// ============================================================================
// Discord Webhook
// ============================================================================
async function sendDiscordWebhook(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  const url = config.url as string | undefined;
  if (!url) throw new Error("Discord webhook URL 未設定");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [
        {
          title: opts.payload.title,
          description: opts.payload.body,
          url: opts.payload.deepLink,
          color: 0x3b82f6, // 藍色
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook ${res.status}: ${await res.text()}`);
  }
}

// ============================================================================
// 通用 webhook（給社團 / Slack / Zapier 等）
// ============================================================================
async function sendGenericWebhook(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  const url = config.url as string | undefined;
  if (!url) throw new Error("Webhook URL 未設定");

  const headers = (config.headers as Record<string, string> | undefined) ?? {};
  const payload = {
    event: opts.eventType,
    fieldId: opts.fieldId,
    squadId: opts.squadId,
    userId: opts.userId,
    title: opts.payload.title,
    body: opts.payload.body,
    deepLink: opts.payload.deepLink,
    timestamp: new Date().toISOString(),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook ${res.status}: ${await res.text()}`);
  }
}

// ============================================================================
// Email（先簡化：用 console.log，未來接 Resend）
// ============================================================================
async function sendEmail(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  // TODO: 接 Resend API（既有 server/services/email.ts 可用）
  // 現階段先 log，避免阻擋部署
  console.log("[email] 待實作 Resend 整合", {
    to: config.toAddress ?? "user",
    title: opts.payload.title,
    body: opts.payload.body,
  });
}

// ============================================================================
// In-app（站內通知）
// ============================================================================
async function writeInAppNotification(opts: NotifyOptions): Promise<void> {
  // 寫入 notification_events 表，type=in_app
  // 玩家中心的「通知」頁可以查這個表
  await db.insert(notificationEvents).values({
    fieldId: opts.fieldId,
    squadId: opts.squadId,
    userId: opts.userId,
    eventType: opts.eventType,
    channelType: "in_app",
    status: "sent",
    payload: opts.payload as unknown as Record<string, unknown>,
    dedupeKey: opts.dedupeKey,
    sentAt: new Date(),
  });
}

// ============================================================================
// 事件啟用判斷
// ============================================================================
function checkEventEnabled(
  eventType: string,
  settings: { [key: string]: unknown } | null | undefined,
): boolean {
  if (!settings) return true; // 沒設定 = 全部開

  switch (eventType) {
    case "first_game":
      return settings.notifyOnFirstGame !== false;
    case "rank_change":
      return settings.notifyOnRankChange !== false;
    case "reward_issued":
      return settings.notifyOnRewardIssued !== false;
    case "tier_upgrade":
      return settings.notifyOnTierUpgrade !== false;
    case "dormancy_warning":
      return settings.notifyOnDormancyWarning !== false;
    default:
      return true;
  }
}
