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
// Email（接 Resend — Phase 15.8）
// ============================================================================
async function sendEmail(
  config: Record<string, unknown>,
  opts: NotifyOptions,
): Promise<void> {
  const toAddress = (config.toAddress as string) ?? null;
  if (!toAddress) {
    console.warn("[email] 跳過：channel config 沒有 toAddress");
    return;
  }

  // 取使用者 email（優先用 config.toAddress；若有 userId 也可從 users 表查）
  const html = renderEmailHtml(opts);
  const text = `${opts.payload.title}\n\n${opts.payload.body}\n\n${
    opts.payload.deepLink ?? ""
  }`;

  const { sendEmail: sendResendEmail } = await import("./email");
  const result = await sendResendEmail({
    to: toAddress,
    subject: opts.payload.title,
    html,
    text,
  });

  if (!result.success) {
    throw new Error(`Email 發送失敗：${result.error ?? "unknown"}`);
  }

  // success: 'resend' 表示真送了，'console-log' 表示沒 API key
  if (result.provider === "console-log") {
    console.log(
      "[email] RESEND_API_KEY 未設定，使用 fallback log（不阻擋）",
    );
  }
}

/** 把 payload 轉成簡單的 HTML email */
function renderEmailHtml(opts: NotifyOptions): string {
  const linkHtml = opts.payload.deepLink
    ? `<p><a href="${opts.payload.deepLink}" style="display:inline-block;padding:12px 24px;background:#0f766e;color:#fff;text-decoration:none;border-radius:6px;">查看詳情</a></p>`
    : "";
  const imgHtml = opts.payload.imageUrl
    ? `<img src="${opts.payload.imageUrl}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:16px 0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="zh-TW"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f3f4f6;padding:20px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;">
    <h1 style="margin:0 0 16px;color:#064e3b;">${escapeHtml(opts.payload.title)}</h1>
    ${imgHtml}
    <p style="color:#374151;line-height:1.6;">${escapeHtml(opts.payload.body)}</p>
    ${linkHtml}
    <p style="margin-top:32px;color:#9ca3af;font-size:12px;">
      此為 CHITO 平台自動寄發的通知，請勿直接回覆。<br>
      <a href="https://game.homi.cc" style="color:#0f766e;">game.homi.cc</a>
    </p>
  </div>
</body></html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
