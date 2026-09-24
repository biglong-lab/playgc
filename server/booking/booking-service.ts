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
  fields,
  type BookingConfig,
  type Booking,
  type BookingScheduleTemplate,
} from "@shared/schema";
import { eq, and, gte, lte, sql, ne, inArray, isNull } from "drizzle-orm";
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

/**
 * 名額範圍：有帶活動就只算該活動的預約，沒帶就只算沒掛活動的（場域層預約）
 * 🐛 2026-09-24：原本同一時段所有活動的人數加在一起 → 不同活動互相佔名額
 */
function activityScope(activityId?: string | null) {
  return activityId ? eq(bookings.activityId, activityId) : isNull(bookings.activityId);
}

/**
 * 取消政策：活動的預約看活動自己的設定，沒掛活動才看場域設定
 * 🐛 2026-09-24：原本一律看場域 → 活動上設的「可否取消 / 幾分鐘前」形同虛設
 */
export async function resolveCancelPolicy(
  fieldId: string,
  activityId?: string | null,
): Promise<{ cancellable: boolean; cancelBeforeMinutes: number }> {
  if (activityId) {
    const { activitySchedules } = await import("@shared/schema");
    const [sched] = await db
      .select({
        cancellable: activitySchedules.cancellable,
        cancelBeforeMinutes: activitySchedules.cancelBeforeMinutes,
      })
      .from(activitySchedules)
      .where(eq(activitySchedules.activityId, activityId))
      .limit(1);
    if (sched) {
      return {
        cancellable: sched.cancellable !== false,
        cancelBeforeMinutes: sched.cancelBeforeMinutes ?? 0,
      };
    }
  }
  const config = await getBookingConfig(fieldId);
  return {
    cancellable: !!config?.cancellable,
    cancelBeforeMinutes: config?.cancelBeforeMinutes ?? 0,
  };
}

/** 取場域預約設定 */
export async function getBookingConfig(fieldId: string): Promise<BookingConfig | null> {
  // 🆕 2026-05-17：case-insensitive 查找（業主回報「/book/JIACHUN 顯示未開通」）
  // 歷史資料 booking_configs.field_id 存小寫 "jiacun"、
  // 但前端 BookPage 從 URL `/book/:fieldCode` 拿到 "JIACHUN" 大寫直接傳入 → 404
  // 修法：DB query 用 lower() 雙邊 normalize、避免大小寫不符
  //
  // 🆕 2026-06-30：field_id 混用 UUID/code 修正（業主回報「改預約時間報『不在開放時段內』」）。
  // booking_configs.field_id 存場域代碼（如 "JIACHUN"），但呼叫端（updateBooking →
  // getAvailability）傳的是 UUID（scope.id）→ 直接比對 miss → 回 [] → 改時間誤判不在開放時段。
  // 先用 fields 表把傳入值（UUID 或 code）正規化成 id + code，兩者一起比對 booking_configs。
  const [field] = await db
    .select({ id: fields.id, code: fields.code })
    .from(fields)
    .where(sql`${fields.id} = ${fieldId} OR lower(${fields.code}) = lower(${fieldId})`)
    .limit(1);
  const cond = field
    ? sql`lower(${bookingConfigs.fieldId}) IN (lower(${field.id}), lower(${field.code}))`
    : sql`lower(${bookingConfigs.fieldId}) = lower(${fieldId})`;
  const rows = await db.select().from(bookingConfigs).where(cond).limit(1);
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
  /**
   * 🐛 2026-09-24：此梯次的單人費用
   * 時段規則可各自設價（日間 249 / 夜間 349），沒設的才用活動基價。
   */
  priceCents: number;
}

/**
 * 排程來源解析（顯示時段、建立預約、改期共用同一套）
 *
 * 🐛 2026-09-24 業主回報「該時段不在開放時段內」根因：
 *   玩家看到的時段來自「活動排程」，建立預約卻去驗「場域預設排程」→ 來源分岔、必定失敗。
 *
 * 業主定調（2026-09-24）：**活動的預約只看活動自己的時段，不跟場域預設耦合**。
 *   場域預設（booking_configs.scheduleTemplate）是活動功能出現前的舊設計，
 *   現在只服務「沒有掛活動的場域層預約」（舊資料 / 單一時間表的場域）。
 *   活動沒設時段 → 就是還不能預約，不會偷用場域的時間表。
 */
export type ScheduleContext =
  | {
      ok: true;
      template: BookingScheduleTemplate;
      capacityOverride?: number;
      /** 沒有時段規則覆寫時的單人費用（活動基價 / 場域預設）*/
      basePriceCents: number;
    }
  | { ok: false; reason: "booking_disabled" | "activity_no_schedule" };

export async function resolveScheduleContext(
  fieldId: string,
  activityId?: string,
): Promise<ScheduleContext> {
  const config = await getBookingConfig(fieldId);
  // 場域層總開關：整個場域關掉預約時，活動也一起關（這是唯一保留的關聯）
  if (!config || !config.isEnabled) return { ok: false, reason: "booking_disabled" };

  if (activityId) {
    const { activities, activitySchedules } = await import("@shared/schema");
    const [act] = await db
      .select({ capacity: activities.capacityPerSlot, priceCents: activities.priceCents })
      .from(activities)
      .where(eq(activities.id, activityId))
      .limit(1);
    const [sched] = await db
      .select({ template: activitySchedules.scheduleTemplate })
      .from(activitySchedules)
      .where(eq(activitySchedules.activityId, activityId))
      .limit(1);
    if (!sched?.template) return { ok: false, reason: "activity_no_schedule" };
    return {
      ok: true,
      template: sched.template as BookingScheduleTemplate,
      capacityOverride: act?.capacity ?? undefined,
      basePriceCents: act?.priceCents ?? config.pricePerSlotCents,
    };
  }

  return {
    ok: true,
    template: config.scheduleTemplate as BookingScheduleTemplate,
    basePriceCents: config.pricePerSlotCents,
  };
}

export async function getAvailability(
  fieldId: string,
  fromDate: Date,
  toDate: Date,
  activityId?: string,
): Promise<AvailableSlot[]> {
  const context = await resolveScheduleContext(fieldId, activityId);
  if (!context.ok) return [];
  const { template, capacityOverride, basePriceCents } = context;

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
        // 🐛 2026-09-24：名額要分活動算。原本同一時段不分活動一起加總 →
        //   「夜間水彈」的預約會吃掉「夜間射擊」同時段的名額。
        activityScope(activityId),
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
        priceCents: s.priceCents ?? basePriceCents,
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
  if (input.partySize < 1) {
    throw new BookingError("invalid_party_size", "人數必須 ≥ 1", 400);
  }

  // 計算 slotEnd 與容量
  // 🐛 2026-09-24：改用與「顯示時段」同一套解析 —— 活動預約只看活動自己的時段。
  //   原本只看場域預設排程 → 玩家看得到的活動時段一律被判「不在開放時段內」。
  const context = await resolveScheduleContext(input.fieldId, input.activityId);
  if (!context.ok) {
    throw context.reason === "activity_no_schedule"
      ? new BookingError("activity_no_schedule", "這個活動還沒有設定可預約時段，請洽場域工作人員", 400)
      : new BookingError("disabled", "場域目前未開放預約", 400);
  }
  const slotsThatDay = getDailySlots(context.template, input.slotStart);
  const matchedSlot = slotsThatDay.find(
    (s) => s.startAt.getTime() === input.slotStart.getTime(),
  );
  if (!matchedSlot) {
    throw new BookingError("slot_not_open", "該時段不在開放時段內", 400);
  }
  // 活動的每梯人數優先（活動設 12 人/梯就以 12 為準）
  const slotCapacity = context.capacityOverride ?? matchedSlot.capacity;

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
        activityScope(input.activityId),
      ),
    );
  const currentBooked = Number(sumResult[0]?.total ?? 0);
  if (currentBooked + input.partySize > slotCapacity) {
    throw new BookingError(
      "slot_full",
      `此時段剩餘 ${slotCapacity - currentBooked} 位、無法容納 ${input.partySize} 位`,
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
        // 不同活動可以同時段各預約一次（例如陪同家人玩不同項目）
        activityScope(input.activityId),
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

  // 🐛 2026-09-24：時段規則的價格才是這一梯真正要收的錢
  //   業主把夜間設 NT$349、日間 NT$249，但這裡只讀活動基價 → 夜間每人少收 100。
  //   規則有設價就以規則為準（這也是後台規則列表顯示的價格）。
  if (typeof matchedSlot.priceCents === "number") {
    priceCents = matchedSlot.priceCents;
    isPaid = priceCents > 0;
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
// 人工登記預約（2026-06-13）— 電話預約由現場人員手動建立
// 與 createBooking 不同：不受 schedule template 限制（可填任意時間）、直接 confirmed、
// 標 admin_note。仍會產 bookingCode + qrToken（可在 POS 掃描報到）。
// ============================================================================

/**
 * 這個時間點該收多少錢
 *
 * 時段規則可以各自設價（日間 249 / 夜間 349）。人工登記允許填任意時間，
 * 所以先找完全相同的梯次，找不到再找「涵蓋這個時刻」的梯次，都沒有才用基價。
 */
export async function resolveSlotPriceCents(
  fieldId: string,
  activityId: string | undefined | null,
  slotStart: Date,
  basePriceCents: number,
): Promise<number> {
  const context = await resolveScheduleContext(fieldId, activityId ?? undefined);
  if (!context.ok) return basePriceCents;
  const slots = getDailySlots(context.template, slotStart);
  const exact = slots.find((s) => s.startAt.getTime() === slotStart.getTime());
  const covering = exact ?? slots.find((s) => s.startAt <= slotStart && slotStart < s.endAt);
  return covering?.priceCents ?? basePriceCents;
}

export interface ManualBookingInput {
  fieldId: string;
  displayName: string;
  phone?: string;
  slotStart: Date;
  /** 不傳則預設 +60 分鐘 */
  slotEnd?: Date;
  partySize: number;
  activityId?: string;
  customerNote?: string;
  adminNote?: string;
  staffId?: string;
}

export async function createManualBooking(input: ManualBookingInput): Promise<CreateBookingResult> {
  if (input.partySize < 1) {
    throw new BookingError("invalid_party_size", "人數必須 ≥ 1", 400);
  }
  if (!input.displayName?.trim()) {
    throw new BookingError("invalid_name", "請填客戶名稱", 400);
  }

  // 金額（若綁活動用活動價）
  let priceCents = 0;
  let activityId: string | null = input.activityId ?? null;
  if (input.activityId) {
    const { activities } = await import("@shared/schema");
    const [activity] = await db
      .select()
      .from(activities)
      .where(eq(activities.id, input.activityId))
      .limit(1);
    if (activity) priceCents = activity.priceCents;
    else activityId = null;
  }
  // 🐛 2026-09-24：電話登記夜間場也要收夜間價（原本一律算活動基價、每人少收）
  if (activityId) {
    priceCents = await resolveSlotPriceCents(
      input.fieldId,
      activityId,
      input.slotStart,
      priceCents,
    );
  }

  // unique code
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
  if (!code) throw new BookingError("code_generation_failed", "預約碼產生失敗、請重試", 500);

  const { randomBytes } = await import("crypto");
  const qrToken = `BK_${randomBytes(28).toString("base64url")}`;
  const slotEnd = input.slotEnd ?? new Date(input.slotStart.getTime() + 60 * 60_000);
  const paymentRequired = priceCents > 0;

  const inserted = await db
    .insert(bookings)
    .values({
      bookingCode: code,
      fieldId: input.fieldId,
      lineUserId: `manual:${code}`,
      displayName: input.displayName.trim(),
      phone: input.phone,
      slotStart: input.slotStart,
      slotEnd,
      partySize: input.partySize,
      status: "confirmed",
      paymentRequired,
      paymentStatus: paymentRequired ? "pending_onsite" : "none",
      amountCents: paymentRequired ? priceCents * input.partySize : 0,
      customerNote: input.customerNote,
      adminNote: input.adminNote ?? "人工登記（電話預約）",
      activityId,
      paymentMode: "onsite",
      qrToken,
      source: "manual",
    })
    .returning();

  // Telegram 群組通知（沿用 createBooking 的通報路徑 → 個人 + 場域群組）
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
// 短連結綁定 LINE（2026-06-13）— 人工建單 → 顧客點短連結 → LINE 綁定閉環
// ============================================================================

/** 公開：用預約碼查最小摘要（給綁定頁顯示，不含敏感資料） */
export async function getBookingSummaryByCode(code: string): Promise<{
  bookingCode: string;
  displayName: string | null;
  slotStart: Date;
  partySize: number;
  status: string;
  fieldId: string;
  fieldCode: string | null;
  fieldName: string | null;
  alreadyBound: boolean;
} | null> {
  // 只選需要的欄位（避免 select * 撞到 DB schema drift）
  const [row] = await db
    .select({
      bookingCode: bookings.bookingCode,
      displayName: bookings.displayName,
      slotStart: bookings.slotStart,
      partySize: bookings.partySize,
      status: bookings.status,
      fieldId: bookings.fieldId,
      lineUserId: bookings.lineUserId,
      fieldCode: fields.code,
      fieldName: fields.name,
    })
    .from(bookings)
    .leftJoin(fields, eq(fields.id, bookings.fieldId))
    .where(eq(bookings.bookingCode, code))
    .limit(1);
  if (!row) return null;
  return {
    bookingCode: row.bookingCode,
    displayName: row.displayName,
    slotStart: row.slotStart,
    partySize: row.partySize,
    status: row.status,
    fieldId: row.fieldId,
    fieldCode: row.fieldCode,
    fieldName: row.fieldName,
    // 已綁＝line_user_id 不是 manual: 前綴
    alreadyBound: !row.lineUserId.startsWith("manual:"),
  };
}

/**
 * 把預約綁到顧客的 LINE userId。
 * 只允許「尚未綁定（manual:）」的預約被綁，避免覆蓋既有 LINE 直訂預約。
 * 回傳是否成功綁定。
 */
export async function bindBookingLine(code: string, lineUserId: string): Promise<boolean> {
  const [b] = await db
    .select({ lineUserId: bookings.lineUserId })
    .from(bookings)
    .where(eq(bookings.bookingCode, code))
    .limit(1);
  if (!b) return false;
  if (!b.lineUserId.startsWith("manual:")) {
    // 已綁定或本就是 LINE 直訂 → 視為已完成、不覆蓋
    return b.lineUserId === lineUserId;
  }
  await db
    .update(bookings)
    .set({ lineUserId, source: "manual_linked", updatedAt: new Date() })
    .where(eq(bookings.bookingCode, code));
  return true;
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
    // 🐛 2026-09-24：活動的預約看活動自己的取消政策（原本一律看場域設定）
    const policy = await resolveCancelPolicy(booking.fieldId, booking.activityId);
    if (!policy.cancellable) {
      throw new BookingError("not_cancellable", "此活動不開放自助取消", 403);
    }
    if (policy.cancelBeforeMinutes > 0) {
      const cutoff = new Date(
        booking.slotStart.getTime() - policy.cancelBeforeMinutes * 60_000,
      );
      if (new Date() > cutoff) {
        throw new BookingError(
          "cancel_too_late",
          `必須在開始前 ${policy.cancelBeforeMinutes} 分鐘前取消`,
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
): Promise<Array<Booking & { activityName?: string | null }>> {
  const statusFilter = options.includeCompleted
    ? undefined
    : ["confirmed", "pending"];

  const conditions = [eq(bookings.lineUserId, lineUserId)];
  if (statusFilter) conditions.push(inArray(bookings.status, statusFilter));

  // 🆕 2026-05-18：join activities 拿活動名（給玩家「我的預約」顯示）
  const { activities } = await import("@shared/schema");
  const rows = await db
    .select({ booking: bookings, activityName: activities.name })
    .from(bookings)
    .leftJoin(activities, eq(bookings.activityId, activities.id))
    .where(and(...conditions))
    .orderBy(bookings.slotStart);

  return rows.map((r) => ({ ...r.booking, activityName: r.activityName }));
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

// ── 編輯預約（改人數/姓名/電話）2026-06-23 ─────────
// 回傳 before/after 供呼叫端寫稽核（誰/何時/前後差異）。加大人數時檢查時段容量。
export interface UpdateBookingInput {
  bookingCode: string;
  /** 場域隔離：同時支援 UUID + code（歷史資料混用）*/
  fieldIds: string[];
  partySize?: number;
  displayName?: string;
  phone?: string;
  slotStart?: Date; // 改時間
}
export async function updateBooking(input: UpdateBookingInput): Promise<{ before: Booking; after: Booking }> {
  const [booking] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.bookingCode, input.bookingCode), inArray(bookings.fieldId, input.fieldIds)))
    .limit(1);
  if (!booking) throw new BookingError("not_found", "找不到此預約", 404);
  if (booking.status === "cancelled") throw new BookingError("cannot_edit", "已取消的預約無法編輯", 400);

  const patch: Partial<typeof bookings.$inferInsert> = { updatedAt: new Date() };
  const newParty = input.partySize ?? booking.partySize;
  if (input.partySize !== undefined && input.partySize < 1) {
    throw new BookingError("invalid_party_size", "人數必須 ≥ 1", 400);
  }

  // 改時間 → 新時段必須開放、未過期、容量足夠
  const changingTime = input.slotStart && input.slotStart.getTime() !== booking.slotStart.getTime();
  if (changingTime) {
    const day = input.slotStart!;
    const slots = await getAvailability(booking.fieldId, day, day, booking.activityId ?? undefined);
    const slot = slots.find((s) => s.startAt === input.slotStart!.toISOString());
    if (!slot) throw new BookingError("slot_not_open", "新時段不在開放時段內", 400);
    if (new Date(slot.startAt) <= new Date()) throw new BookingError("slot_passed", "新時段已過、無法改", 400);
    // 新時段不含本筆 → booked + 新人數 須 ≤ capacity
    if (slot.booked + newParty > slot.capacity) {
      throw new BookingError("slot_full", `新時段剩餘 ${slot.capacity - slot.booked} 位、無法容納 ${newParty} 位`, 409);
    }
    patch.slotStart = input.slotStart!;
    patch.slotEnd = new Date(slot.endAt);
  } else if (input.partySize !== undefined && input.partySize > booking.partySize) {
    // 只加大人數（同時段）→ 排除本筆後檢查容量
    const day = new Date(booking.slotStart);
    const slots = await getAvailability(booking.fieldId, day, day, booking.activityId ?? undefined);
    const slot = slots.find((s) => s.startAt === booking.slotStart.toISOString());
    if (slot) {
      const others = slot.booked - booking.partySize;
      if (others + input.partySize > slot.capacity) {
        throw new BookingError("slot_full", `此時段剩餘 ${slot.capacity - others} 位、無法容納 ${input.partySize} 位`, 409);
      }
    }
  }

  if (input.partySize !== undefined) patch.partySize = input.partySize;
  if (input.displayName !== undefined) patch.displayName = input.displayName.trim().slice(0, 100) || null;
  if (input.phone !== undefined) patch.phone = input.phone.trim().slice(0, 20) || null;

  const [after] = await db.update(bookings).set(patch).where(eq(bookings.id, booking.id)).returning();
  return { before: booking, after: after! };
}
