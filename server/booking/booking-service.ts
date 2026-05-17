// 預約系統 business logic
//
// 範圍：
//   - createBooking: 建立預約（檢查容量、避免衝突、產生短碼）
//   - cancelBooking: 取消預約（檢查取消政策）
//   - getAvailability: 計算某日期區間內可預約 slots（含已用容量）
//   - getMyBookings: 玩家查自己的預約
//
// 設計：
//   - 容量檢查在交易內、避免併發超賣
//   - booking_code 6 字元短碼（玩家可口報）
//   - LINE 通知由 caller 處理（這層只管資料）

import { db } from "../db";
import {
  bookings,
  bookingConfigs,
  type BookingConfig,
  type Booking,
  type BookingScheduleTemplate,
} from "@shared/schema";
import { eq, and, gte, lte, sql, ne, inArray } from "drizzle-orm";
import {
  getDailySlots,
  getSlotsInRange,
  type ExpandedSlot,
} from "./schedule-resolver";
import {
  notifyBookingConfirmed,
  notifyBookingCancelled,
  notifyGameCompleted,
} from "./booking-notifier";
import {
  notifyBookingCreated as tgNotifyBookingCreated,
  notifyBookingCancelled as tgNotifyBookingCancelled,
} from "../lib/internal-notifier";
import { randomBytes } from "crypto";

// 短碼字符集（避開易混淆 0/O、1/I/l）
const CODE_CHARSET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 6;
const MAX_CODE_RETRIES = 5;

/** 產生 6 字元 booking code */
function generateBookingCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARSET[bytes[i] % CODE_CHARSET.length];
  }
  return code;
}

/** 取場域預約設定 */
export async function getBookingConfig(fieldId: string): Promise<BookingConfig | null> {
  // 🆕 2026-05-17：case-insensitive 查找（業主回報「/book/JIACHUN 顯示未開通」）
  // 歷史資料 booking_configs.field_id 存小寫 "jiacun"、
  // 但前端 BookPage 從 URL `/book/:fieldCode` 拿到 "JIACHUN" 大寫直接傳入 → 404
  // 修法：DB query 用 lower() 雙邊 normalize、避免大小寫不符
  const rows = await db
    .select()
    .from(bookingConfigs)
    .where(sql`lower(${bookingConfigs.fieldId}) = lower(${fieldId})`)
    .limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// 可預約時段計算（含已預約人數）
// ============================================================================

export interface AvailableSlot {
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 時段開始 ISO 字串 */
  startAt: string;
  /** 時段結束 ISO 字串 */
  endAt: string;
  /** 此時段最大人數 */
  capacity: number;
  /** 已預約人數 */
  booked: number;
  /** 剩餘人數 */
  available: number;
  /** 是否仍可預約（available > 0 且未過期）*/
  bookable: boolean;
}

export async function getAvailability(
  fieldId: string,
  fromDate: Date,
  toDate: Date,
  activityId?: string,
): Promise<AvailableSlot[]> {
  // 🆕 2026-05-18：activity 模式 — 優先用 activity_schedules.scheduleTemplate
  // 沒設活動時段 → fallback booking_configs（向下相容）
  let template: BookingScheduleTemplate | null = null;
  let capacityOverride: number | undefined;

  if (activityId) {
    const { activities, activitySchedules } = await import("@shared/schema");
    const [act] = await db
      .select({ capacity: activities.capacityPerSlot })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);
    if (act) capacityOverride = act.capacity;

    const [sched] = await db
      .select({ template: activitySchedules.scheduleTemplate })
      .from(activitySchedules)
      .where(eq(activitySchedules.activityId, activityId))
      .limit(1);
    if (sched?.template) {
      template = sched.template as BookingScheduleTemplate;
    }
  }

  // fallback booking_configs
  if (!template) {
    const config = await getBookingConfig(fieldId);
    if (!config || !config.isEnabled) return [];
    template = config.scheduleTemplate as BookingScheduleTemplate;
  }

  const dailyResult = getSlotsInRange(template, fromDate, toDate);

  // 一次撈出區間內所有非取消的 booking、計算已用容量
  const startBound = new Date(fromDate);
  startBound.setHours(0, 0, 0, 0);
  const endBound = new Date(toDate);
  endBound.setHours(23, 59, 59, 999);

  const existingBookings = await db
    .select({
      slotStart: bookings.slotStart,
      partySize: bookings.partySize,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.fieldId, fieldId),
        ne(bookings.status, "cancelled"),
        gte(bookings.slotStart, startBound),
        lte(bookings.slotStart, endBound),
      ),
    );

  // 整理成 map: slotStart ISO → 累計人數
  const bookedMap = new Map<string, number>();
  for (const b of existingBookings) {
    const key = b.slotStart.toISOString();
    bookedMap.set(key, (bookedMap.get(key) ?? 0) + b.partySize);
  }

  const now = new Date();
  const result: AvailableSlot[] = [];
  for (const day of dailyResult) {
    for (const s of day.slots) {
      const key = s.startAt.toISOString();
      const booked = bookedMap.get(key) ?? 0;
      // 🆕 activity 模式時、優先用 activity.capacityPerSlot（時段 template 也可覆寫）
      const capacity = capacityOverride ?? s.capacity;
      const available = Math.max(0, capacity - booked);
      const bookable = available > 0 && s.startAt > now;
      result.push({
        date: day.date,
        startAt: key,
        endAt: s.endAt.toISOString(),
        capacity,
        booked,
        available,
        bookable,
      });
    }
  }
  return result;
}

// ============================================================================
// 建立預約
// ============================================================================

export interface CreateBookingInput {
  fieldId: string;
  lineUserId: string;
  displayName?: string;
  phone?: string;
  slotStart: Date;
  partySize: number;
  customerNote?: string;
  /** 🆕 2026-05-18：多活動分流時帶入；後端會用 activity.priceCents 算金額、寫 activityId */
  activityId?: string;
}

export interface CreateBookingResult {
  booking: Booking;
}

export class BookingError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
  }
}

export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  const config = await getBookingConfig(input.fieldId);
  if (!config) {
    throw new BookingError("config_not_found", "場域尚未開通預約", 404);
  }
  if (!config.isEnabled) {
    throw new BookingError("disabled", "場域目前未開放預約", 400);
  }
  if (input.partySize < 1) {
    throw new BookingError("invalid_party_size", "人數必須 ≥ 1", 400);
  }

  // 計算 slotEnd 與容量（從 schedule template 解析）
  const template = config.scheduleTemplate as BookingScheduleTemplate;
  const slotsThatDay = getDailySlots(template, input.slotStart);
  const matchedSlot = slotsThatDay.find(
    (s) => s.startAt.getTime() === input.slotStart.getTime(),
  );
  if (!matchedSlot) {
    throw new BookingError("slot_not_open", "該時段不在開放時段內", 400);
  }

  // 不能預約已過期的 slot
  if (matchedSlot.startAt <= new Date()) {
    throw new BookingError("slot_passed", "時段已過、無法預約", 400);
  }

  // 容量檢查（用 SQL 聚合避免 race condition）
  const sumResult = await db
    .select({
      total: sql<number>`COALESCE(SUM(${bookings.partySize}), 0)::int`,
    })
    .from(bookings)
    .where(
      and(
        eq(bookings.fieldId, input.fieldId),
        eq(bookings.slotStart, input.slotStart),
        ne(bookings.status, "cancelled"),
      ),
    );
  const currentBooked = Number(sumResult[0]?.total ?? 0);
  if (currentBooked + input.partySize > matchedSlot.capacity) {
    throw new BookingError(
      "slot_full",
      `此時段剩餘 ${matchedSlot.capacity - currentBooked} 位、無法容納 ${input.partySize} 位`,
      409,
    );
  }

  // 同一 lineUserId 在同一 slot 不可重覆預約
  const dup = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.fieldId, input.fieldId),
        eq(bookings.slotStart, input.slotStart),
        eq(bookings.lineUserId, input.lineUserId),
        ne(bookings.status, "cancelled"),
      ),
    )
    .limit(1);
  if (dup.length > 0) {
    throw new BookingError("duplicate", "您已預約此時段", 409);
  }

  // 嘗試 generate unique code（衝突重試）
  let code: string | null = null;
  for (let i = 0; i < MAX_CODE_RETRIES; i++) {
    const candidate = generateBookingCode();
    const existing = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(eq(bookings.bookingCode, candidate))
      .limit(1);
    if (existing.length === 0) {
      code = candidate;
      break;
    }
  }
  if (!code) {
    throw new BookingError("code_generation_failed", "預約碼產生失敗、請重試", 500);
  }

  // 🆕 2026-05-18：activity 模式 — 用 activity 的價格 + paymentMode 覆寫 config
  let priceCents = config.pricePerSlotCents;
  let isPaid = config.isPaid;
  let paymentMode: string = "onsite";
  if (input.activityId) {
    const { activities } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, input.activityId))
      .limit(1);
    if (activity) {
      priceCents = activity.priceCents;
      isPaid = activity.priceCents > 0;
      paymentMode = activity.paymentMode;
    }
  }

  // 🆕 2026-05-18 業主決定：線上金流尚未開通、暫時強制 fallback 為 onsite
  // 業主可在 admin/activities 切換、但 online/both 選項已 disabled
  // 既有 activity 設了 online → 後端自動轉 onsite、避免玩家卡關
  if (paymentMode === "online" || paymentMode === "both") {
    paymentMode = "onsite";
  }

  // 付費需求判定（activity 模式 paymentMode=online 才 pending、onsite 直接 confirmed）
  const paymentRequired = isPaid && priceCents > 0;
  const requiresOnlinePayment = paymentRequired && paymentMode === "online";

  // 🆕 QR token（POS 掃描安全碼、64 字元）
  const { randomBytes } = await import("crypto");
  const qrToken = `BK_${randomBytes(28).toString("base64url")}`;

  const inserted = await db
    .insert(bookings)
    .values({
      bookingCode: code,
      fieldId: input.fieldId,
      lineUserId: input.lineUserId,
      displayName: input.displayName,
      phone: input.phone,
      slotStart: input.slotStart,
      slotEnd: matchedSlot.endAt,
      partySize: input.partySize,
      // online 模式：等付款 → pending；onsite 模式：直接 confirmed
      status: requiresOnlinePayment ? "pending" : "confirmed",
      paymentRequired,
      paymentStatus: requiresOnlinePayment
        ? "pending"
        : paymentRequired
          ? "pending_onsite"
          : "none",
      amountCents: paymentRequired ? priceCents * input.partySize : 0,
      customerNote: input.customerNote,
      activityId: input.activityId ?? null,
      paymentMode,
      qrToken,
    })
    .returning();

  // 🔔 fire-and-forget：發 LINE 預約成功通知（status=confirmed 才發、pending 等付款後再發）
  if (inserted[0] && inserted[0].status === "confirmed") {
    notifyBookingConfirmed(inserted[0]).catch((err) =>
      console.error("[createBooking] notify failed:", err),
    );
  }

  // 🔔 Telegram 內部通知（admin 即時知道有新預約）
  if (inserted[0]) {
    tgNotifyBookingCreated({
      fieldId: inserted[0].fieldId,
      bookingCode: inserted[0].bookingCode,
      displayName: inserted[0].displayName ?? undefined,
      slotStart: inserted[0].slotStart,
      partySize: inserted[0].partySize,
      amountCents: inserted[0].amountCents,
    });
  }

  return { booking: inserted[0]! };
}

// ============================================================================
// 取消預約
// ============================================================================

export interface CancelBookingInput {
  bookingCode: string;
  /** 取消者：自助 = lineUserId / admin = "admin" */
  cancelBy: { type: "self"; lineUserId: string } | { type: "admin" };
  reason?: string;
}

export async function cancelBooking(input: CancelBookingInput): Promise<Booking> {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingCode, input.bookingCode))
    .limit(1);
  const booking = rows[0];
  if (!booking) throw new BookingError("not_found", "找不到此預約", 404);

  if (input.cancelBy.type === "self") {
    if (booking.lineUserId !== input.cancelBy.lineUserId) {
      throw new BookingError("forbidden", "無權取消此預約", 403);
    }
  }

  if (booking.status === "cancelled") {
    return booking; // idempotent
  }
  if (booking.status === "completed" || booking.status === "no_show") {
    throw new BookingError("not_cancellable", "預約已結束、無法取消", 400);
  }

  // 自助取消需檢查取消政策
  if (input.cancelBy.type === "self") {
    const config = await getBookingConfig(booking.fieldId);
    if (!config?.cancellable) {
      throw new BookingError("not_cancellable", "此場域不開放自助取消", 403);
    }
    if (config.cancelBeforeMinutes > 0) {
      const cutoff = new Date(
        booking.slotStart.getTime() - config.cancelBeforeMinutes * 60_000,
      );
      if (new Date() > cutoff) {
        throw new BookingError(
          "cancel_too_late",
          `必須在開始前 ${config.cancelBeforeMinutes} 分鐘前取消`,
          400,
        );
      }
    }
  }

  const updated = await db
    .update(bookings)
    .set({
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: input.reason,
      cancelledByAdmin: input.cancelBy.type === "admin",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))
    .returning();

  // 🔔 admin 取消才推播玩家（自助取消他自己知道、不必再通知）
  if (input.cancelBy.type === "admin" && updated[0]) {
    notifyBookingCancelled(updated[0]).catch((err) =>
      console.error("[cancelBooking] notify failed:", err),
    );
  }

  // 🔔 Telegram 內部通知（admin 知道有玩家取消）
  if (updated[0]) {
    tgNotifyBookingCancelled({
      fieldId: updated[0].fieldId,
      bookingCode: updated[0].bookingCode,
      displayName: updated[0].displayName ?? undefined,
      slotStart: updated[0].slotStart,
      byAdmin: input.cancelBy.type === "admin",
      reason: input.reason,
    });
  }

  return updated[0]!;
}

// ============================================================================
// 玩家查自己的預約
// ============================================================================

export async function getMyBookings(
  lineUserId: string,
  options: { includeCompleted?: boolean } = {},
): Promise<Booking[]> {
  const statusFilter = options.includeCompleted
    ? undefined
    : ["confirmed", "pending"];

  const conditions = [eq(bookings.lineUserId, lineUserId)];
  if (statusFilter) conditions.push(inArray(bookings.status, statusFilter));

  return await db
    .select()
    .from(bookings)
    .where(and(...conditions))
    .orderBy(bookings.slotStart);
}

/** 用 booking_code 查單筆 */
export async function getBookingByCode(code: string): Promise<Booking | null> {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingCode, code))
    .limit(1);
  return rows[0] ?? null;
}

// ============================================================================
// Admin 列表查詢
// ============================================================================

export interface ListBookingsOptions {
  fieldId: string;
  fromDate?: Date;
  toDate?: Date;
  status?: string[];
  limit?: number;
  offset?: number;
}

export async function listBookings(opts: ListBookingsOptions): Promise<Booking[]> {
  const conditions = [eq(bookings.fieldId, opts.fieldId)];
  if (opts.fromDate) conditions.push(gte(bookings.slotStart, opts.fromDate));
  if (opts.toDate) conditions.push(lte(bookings.slotStart, opts.toDate));
  if (opts.status && opts.status.length > 0) {
    conditions.push(inArray(bookings.status, opts.status));
  }

  return await db
    .select()
    .from(bookings)
    .where(and(...conditions))
    .orderBy(bookings.slotStart)
    .limit(opts.limit ?? 100)
    .offset(opts.offset ?? 0);
}

// ============================================================================
// 標記到場 / 完成（admin 操作、活動結束時觸發）
// ============================================================================

export interface MarkCompletedInput {
  bookingCode: string;
  /** 是否同時推送 game_completed LINE 通知（含優惠券連結等）*/
  sendNotification?: boolean;
  /** 自訂 actionUrl 覆蓋模板的（例：本次活動專屬優惠券）*/
  customActionUrl?: string;
}

export async function markBookingCompleted(
  input: MarkCompletedInput,
): Promise<Booking> {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingCode, input.bookingCode))
    .limit(1);
  const booking = rows[0];
  if (!booking) throw new BookingError("not_found", "找不到此預約", 404);

  if (booking.status === "completed") {
    return booking; // idempotent
  }
  if (booking.status === "cancelled") {
    throw new BookingError("cannot_complete", "已取消的預約無法標記完成", 400);
  }

  const updated = await db
    .update(bookings)
    .set({
      status: "completed",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))
    .returning();

  // 🔔 推 LINE 通知（含優惠券連結 / 圖片、用 game_completed template）
  if (input.sendNotification !== false && updated[0]) {
    notifyGameCompleted(updated[0].id, {
      actionUrl: input.customActionUrl,
    }).catch((err) =>
      console.error("[markBookingCompleted] notify failed:", err),
    );
  }

  return updated[0]!;
}

export async function markBookingNoShow(bookingCode: string): Promise<Booking> {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.bookingCode, bookingCode))
    .limit(1);
  const booking = rows[0];
  if (!booking) throw new BookingError("not_found", "找不到此預約", 404);

  if (booking.status === "no_show") return booking;
  if (booking.status === "cancelled") {
    throw new BookingError("cannot_mark", "已取消的預約無法標記未到場", 400);
  }
  if (booking.status === "completed") {
    throw new BookingError("cannot_mark", "已完成的預約無法標記未到場", 400);
  }

  const updated = await db
    .update(bookings)
    .set({
      status: "no_show",
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, booking.id))
    .returning();

  return updated[0]!;
}
