// 預約相關 LINE 通知 service — Phase δ W2 D1
//
// 4 個觸發點：
//   1. booking_confirmed   — 預約成功（push, 1 quota）
//   2. reminder_30min      — 開始前 N 分鐘（push, 1 quota；走 cron）
//   3. game_start_keyword  — 玩家傳「開始遊戲」/「我要玩」(reply, 0 quota)
//   4. game_completed      — 遊戲結束送禮（push, 1 quota；可由 game complete hook 觸發）
//
// 模板：
//   - 從 booking_notification_templates 讀（業主可自訂）
//   - 找不到就用 default
//
// Quota 控制：
//   - reply 路徑（path 3）→ 不扣 quota、首選
//   - push 路徑（1, 2, 4）→ 扣 quota、必要時用
//
// 業主 / 系統管理員可隨時 disable 某類通知（template.is_active）

import { db } from "../db";
import {
  bookings,
  bookingNotificationTemplates,
  bookingConfigs,
  fields,
  type Booking,
  type BookingNotificationTemplateKey,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { pushMessage, type LineMessage } from "../lib/line-bot";

// 🆕 2026-05-17 per-field：用 resolveLineConfig 動態查 booking.fieldId 的 LINE channel
// 全域 fallback 由 resolver 處理（env 仍可用作 fallback）
import { resolveLineConfig } from "../lib/line-config-resolver";
const APP_BASE_URL = process.env.APP_BASE_URL || "https://game.homi.cc";

interface NotifyContext {
  booking: Booking;
  /** 從 fields 表撈場域名稱、可選 */
  fieldName?: string;
}

/**
 * 替換 placeholder：{playerName} {bookingCode} {slotTime} {fieldName} {partySize} {actionUrl}
 */
function renderTemplate(template: string, ctx: NotifyContext, extra: Record<string, string> = {}): string {
  const slotStartDate = new Date(ctx.booking.slotStart);
  const slotTimeStr = slotStartDate.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "narrow",
  });

  const replacements: Record<string, string> = {
    playerName: ctx.booking.displayName || "玩家",
    bookingCode: ctx.booking.bookingCode,
    slotTime: slotTimeStr,
    fieldName: ctx.fieldName || ctx.booking.fieldId,
    partySize: String(ctx.booking.partySize),
    ...extra,
  };
  return template.replace(/\{(\w+)\}/g, (_, k) => replacements[k] ?? `{${k}}`);
}

/**
 * 取出某 fieldId 對應 templateKey 的訊息模板
 */
async function getTemplate(
  fieldId: string,
  key: BookingNotificationTemplateKey,
): Promise<{
  messageText: string;
  flexMessageJson?: Record<string, unknown> | null;
  actionUrl?: string | null;
  imageUrl?: string | null;
} | null> {
  const rows = await db
    .select()
    .from(bookingNotificationTemplates)
    .where(
      and(
        eq(bookingNotificationTemplates.fieldId, fieldId),
        eq(bookingNotificationTemplates.templateKey, key),
        eq(bookingNotificationTemplates.isActive, true),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// Default 模板（業主沒設時的 fallback）
// ============================================================================

const DEFAULT_TEMPLATES: Record<BookingNotificationTemplateKey, string> = {
  booking_confirmed:
    "✅ {playerName} 您好、預約成功！\n\n" +
    "📅 {slotTime}\n" +
    "👥 {partySize} 人\n" +
    "🎫 預約碼 {bookingCode}\n\n" +
    "活動開始前 30 分鐘將再次提醒您。",
  reminder_30min:
    "⏰ {playerName} 您好、活動 30 分鐘後開始！\n\n" +
    "📅 {slotTime}\n" +
    "🎫 預約碼 {bookingCode}\n\n" +
    "請準時抵達現場、期待見到您！",
  game_start_keyword:
    "🎮 開始遊戲囉！\n\n" +
    "點此進入遊戲：\n{actionUrl}\n\n" +
    "祝您玩得開心！",
  game_completed:
    "🏁 {playerName} 感謝您的參與！\n\n" +
    "您的回憶已紀錄、可隨時回顧。\n" +
    "點此查看：\n{actionUrl}",
  booking_cancelled:
    "🚫 {playerName} 您好、預約已取消。\n\n" +
    "📅 原預約時段：{slotTime}\n" +
    "🎫 預約碼 {bookingCode}\n\n" +
    "歡迎再次預約。",
};

// ============================================================================
// Internal: 組合 LineMessage（純文字 + 可選圖片）
// ============================================================================

interface ResolvedTemplate {
  text: string;
  imageUrl?: string;
  actionUrl?: string;
  flex?: Record<string, unknown>;
}

async function resolveTemplate(
  fieldId: string,
  key: BookingNotificationTemplateKey,
  ctx: NotifyContext,
  extra: Record<string, string> = {},
): Promise<ResolvedTemplate> {
  const tpl = await getTemplate(fieldId, key);
  const messageText = tpl?.messageText ?? DEFAULT_TEMPLATES[key];
  return {
    text: renderTemplate(messageText, ctx, {
      ...extra,
      actionUrl: tpl?.actionUrl ?? extra.actionUrl ?? "",
    }),
    imageUrl: tpl?.imageUrl ?? undefined,
    actionUrl: tpl?.actionUrl ?? extra.actionUrl,
    flex: (tpl?.flexMessageJson as Record<string, unknown>) ?? undefined,
  };
}

function buildMessages(resolved: ResolvedTemplate): LineMessage[] {
  const messages: LineMessage[] = [];
  // 業主自訂 flex → 直接用
  if (resolved.flex) {
    messages.push({
      type: "flex",
      altText: resolved.text.split("\n")[0]?.slice(0, 60) || "預約通知",
      contents: resolved.flex,
    } as LineMessage);
    return messages;
  }
  if (resolved.imageUrl) {
    messages.push({
      type: "image",
      originalContentUrl: resolved.imageUrl,
      previewImageUrl: resolved.imageUrl,
    });
  }
  messages.push({ type: "text", text: resolved.text });
  return messages;
}

// 🆕 2026-05-18：預約成功卡片式 Flex Message（業主沒設 flex 時的預設）
// 結構：封面圖 + 標題 + 4 欄資訊 + CTA 按鈕
function buildBookingConfirmedFlex(
  booking: Booking,
  ctx: { fieldName?: string },
  coverUrl: string,
  detailUrl: string,
): Record<string, unknown> {
  const slotStartDate = new Date(booking.slotStart);
  const dateStr = slotStartDate.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = slotStartDate.toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  return {
    type: "bubble",
    hero: {
      type: "image",
      url: coverUrl,
      size: "full",
      aspectRatio: "20:13",
      aspectMode: "cover",
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        {
          type: "text",
          text: `✅ ${booking.displayName || "您"} 預約成功！`,
          weight: "bold",
          size: "lg",
          color: "#16A34A",
          wrap: true,
        },
        ...(ctx.fieldName
          ? [{ type: "text", text: ctx.fieldName, size: "sm", color: "#64748B" }]
          : []),
        { type: "separator", margin: "md" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          contents: [
            kv("📅 時間", `${dateStr} ${timeStr}`),
            kv("👥 人數", `${booking.partySize} 人`),
            kv("🎟️ 預約碼", booking.bookingCode, true),
          ],
        },
        {
          type: "text",
          text: "活動開始前 30 分鐘將再次提醒您。",
          size: "xs",
          color: "#94A3B8",
          margin: "md",
          wrap: true,
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#16A34A",
          action: {
            type: "uri",
            label: "查看預約詳情",
            uri: detailUrl,
          },
        },
      ],
    },
  };
}

async function getFieldName(fieldId: string): Promise<string | undefined> {
  try {
    const [row] = await db
      .select({ name: fields.name })
      .from(fields)
      .where(eq(fields.id, fieldId))
      .limit(1);
    return row?.name ?? undefined;
  } catch {
    return undefined;
  }
}

function kv(label: string, value: string, mono = false): Record<string, unknown> {
  return {
    type: "box",
    layout: "baseline",
    spacing: "sm",
    contents: [
      { type: "text", text: label, size: "sm", color: "#64748B", flex: 3 },
      {
        type: "text",
        text: value,
        size: "sm",
        color: "#0F172A",
        weight: mono ? "bold" : "regular",
        flex: 5,
        wrap: true,
      },
    ],
  };
}

// ============================================================================
// 1. 預約成功通知（push、扣 1 quota）
// ============================================================================

export async function notifyBookingConfirmed(booking: Booking): Promise<{ sent: boolean; reason?: string }> {
  const lineConfig = await resolveLineConfig(booking.fieldId);
  if (!lineConfig.accessToken) return { sent: false, reason: "no_access_token" };
  if (booking.confirmNotifiedAt) return { sent: false, reason: "already_notified" };

  try {
    const resolved = await resolveTemplate(booking.fieldId, "booking_confirmed", { booking });
    // 🆕 2026-05-18：業主沒自訂 flex → 用預設預約成功卡片
    if (!resolved.flex) {
      const fieldName = await getFieldName(booking.fieldId);
      const coverUrl = resolved.imageUrl || `${APP_BASE_URL}/booking-cover-default.jpg`;
      const detailUrl = `${APP_BASE_URL}/book/${booking.fieldId}/done/${booking.bookingCode}`;
      resolved.flex = buildBookingConfirmedFlex(booking, { fieldName }, coverUrl, detailUrl);
    }
    await pushMessage({
      accessToken: lineConfig.accessToken,
      to: booking.lineUserId,
      messages: buildMessages(resolved),
    });
    await db
      .update(bookings)
      .set({ confirmNotifiedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    return { sent: true };
  } catch (err) {
    console.error("[booking-notifier] notifyBookingConfirmed 失敗:", err);
    return { sent: false, reason: "push_failed" };
  }
}

// ============================================================================
// 2. 開始前 N 分鐘提醒（push、扣 1 quota）— 由 cron 呼叫
// ============================================================================

export async function notifyBookingReminder(booking: Booking): Promise<{ sent: boolean; reason?: string }> {
  const lineConfig = await resolveLineConfig(booking.fieldId);
  if (!lineConfig.accessToken) return { sent: false, reason: "no_access_token" };
  if (booking.reminderSentAt) return { sent: false, reason: "already_notified" };
  if (booking.status !== "confirmed" && booking.status !== "pending") {
    return { sent: false, reason: "wrong_status" };
  }

  try {
    const resolved = await resolveTemplate(booking.fieldId, "reminder_30min", { booking });
    await pushMessage({
      accessToken: lineConfig.accessToken,
      to: booking.lineUserId,
      messages: buildMessages(resolved),
    });
    await db
      .update(bookings)
      .set({ reminderSentAt: new Date() })
      .where(eq(bookings.id, booking.id));
    return { sent: true };
  } catch (err) {
    console.error("[booking-notifier] notifyBookingReminder 失敗:", err);
    return { sent: false, reason: "push_failed" };
  }
}

// ============================================================================
// 3. 玩家「開始遊戲」關鍵字回覆（reply、不扣 quota）
//    從 line-webhook 呼叫
// ============================================================================

export interface GameStartReplyResult {
  messages: LineMessage[];
}

export async function buildGameStartReply(lineUserId: string): Promise<GameStartReplyResult | null> {
  // 找此玩家最近未結束的預約（時間最接近現在）
  const now = new Date();
  const upcoming = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.lineUserId, lineUserId),
        eq(bookings.status, "confirmed"),
      ),
    );

  if (upcoming.length === 0) return null;

  // 取「最近 1 小時內到 30 分後」的預約（多人能多次玩）
  const nearestBooking = upcoming
    .filter((b) => {
      const diffMin = (b.slotStart.getTime() - now.getTime()) / 60_000;
      return diffMin > -120 && diffMin < 60; // 開始前 60 分鐘到開始後 120 分鐘內
    })
    .sort((a, b) => Math.abs(a.slotStart.getTime() - now.getTime()) - Math.abs(b.slotStart.getTime() - now.getTime()))[0];

  if (!nearestBooking) return null;

  const resolved = await resolveTemplate(
    nearestBooking.fieldId,
    "game_start_keyword",
    { booking: nearestBooking },
    {
      // 預設：直接連到該場域首頁（玩家現場進場後選遊戲）
      // 業主可在 template 設更精確 actionUrl
      actionUrl: `${APP_BASE_URL}/f/${nearestBooking.fieldId}`,
    },
  );

  return { messages: buildMessages(resolved) };
}

// ============================================================================
// 4. 遊戲完成通知（push、扣 1 quota）
//    可由 game session complete hook 呼叫
//    若 booking 沒設 game_completed template、或 actionUrl 為空、可不送
// ============================================================================

export async function notifyGameCompleted(
  bookingId: number,
  options: { actionUrl?: string; imageUrlOverride?: string } = {},
): Promise<{ sent: boolean; reason?: string }> {
  const rows = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  const booking = rows[0];
  if (!booking) return { sent: false, reason: "not_found" };
  if (booking.completedNotifiedAt) return { sent: false, reason: "already_notified" };

  const lineConfig = await resolveLineConfig(booking.fieldId);
  if (!lineConfig.accessToken) return { sent: false, reason: "no_access_token" };

  try {
    const resolved = await resolveTemplate(
      booking.fieldId,
      "game_completed",
      { booking },
      {
        actionUrl: options.actionUrl ?? "",
      },
    );
    if (options.imageUrlOverride) resolved.imageUrl = options.imageUrlOverride;

    // 若沒 actionUrl 也沒模板、不發（避免送空訊息）
    if (!resolved.text || resolved.text.trim().length === 0) {
      return { sent: false, reason: "empty_template" };
    }

    await pushMessage({
      accessToken: lineConfig.accessToken,
      to: booking.lineUserId,
      messages: buildMessages(resolved),
    });
    await db
      .update(bookings)
      .set({ completedNotifiedAt: new Date() })
      .where(eq(bookings.id, booking.id));
    return { sent: true };
  } catch (err) {
    console.error("[booking-notifier] notifyGameCompleted 失敗:", err);
    return { sent: false, reason: "push_failed" };
  }
}

// ============================================================================
// 5. 取消通知（push、扣 1 quota；admin 取消時自動寄、自助取消可選）
// ============================================================================

export async function notifyBookingCancelled(booking: Booking): Promise<{ sent: boolean; reason?: string }> {
  const lineConfig = await resolveLineConfig(booking.fieldId);
  if (!lineConfig.accessToken) return { sent: false, reason: "no_access_token" };

  try {
    const resolved = await resolveTemplate(booking.fieldId, "booking_cancelled", { booking });
    await pushMessage({
      accessToken: lineConfig.accessToken,
      to: booking.lineUserId,
      messages: buildMessages(resolved),
    });
    return { sent: true };
  } catch (err) {
    console.error("[booking-notifier] notifyBookingCancelled 失敗:", err);
    return { sent: false, reason: "push_failed" };
  }
}

/**
 * 取得業主提醒分鐘設定
 */
export async function getReminderMinutes(fieldId: string): Promise<number> {
  const rows = await db
    .select({ m: bookingConfigs.reminderMinutesBefore })
    .from(bookingConfigs)
    .where(eq(bookingConfigs.fieldId, fieldId))
    .limit(1);
  return rows[0]?.m ?? 30;
}
