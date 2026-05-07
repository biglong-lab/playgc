// 預約提醒 cron — Phase δ W2 D2
//
// 每分鐘掃描即將開始的預約、推送 LINE 提醒。
//
// 邏輯：
//   1. 每分鐘跑一次
//   2. 撈出 status=confirmed/pending、reminderSentAt IS NULL、
//      slotStart 落在 [now, now + reminderMinutesBefore] 範圍的預約
//   3. 對每筆呼叫 notifyBookingReminder
//
// 為了 quota 保護：
//   - 撈出時做 reminderMinutesBefore window check（用 booking_configs.reminderMinutesBefore）
//   - 若業主設 reminderMinutesBefore=0 → 不發提醒
//
// 啟動位置：server/index.ts startup

import { db } from "../db";
import { bookings, bookingConfigs } from "@shared/schema";
import { eq, and, gte, lte, isNull, sql } from "drizzle-orm";
import { notifyBookingReminder } from "./booking-notifier";

const CRON_INTERVAL_MS = 60_000; // 1 分鐘
const MAX_PER_TICK = 50; // 一次處理上限、避免單次推太多

let timer: NodeJS.Timeout | null = null;

async function runOnce(): Promise<void> {
  try {
    // 1. 撈出各 fieldId 的 reminderMinutesBefore（用 join）
    //    我們需要 booking 跟其場域的 reminder 分鐘
    const candidates = await db
      .select({
        booking: bookings,
        reminderMins: bookingConfigs.reminderMinutesBefore,
      })
      .from(bookings)
      .leftJoin(
        bookingConfigs,
        eq(bookingConfigs.fieldId, bookings.fieldId),
      )
      .where(
        and(
          isNull(bookings.reminderSentAt),
          isNull(bookings.cancelledAt),
          // status 限定為可推
          sql`${bookings.status} IN ('confirmed', 'pending')`,
          // slotStart > 現在（沒過期）
          gte(bookings.slotStart, sql`NOW()`),
          // 60 分鐘內（最大可能 reminder window；實際下方再 filter）
          lte(bookings.slotStart, sql`NOW() + INTERVAL '60 minutes'`),
        ),
      )
      .limit(MAX_PER_TICK * 3);

    if (candidates.length === 0) return;

    const now = new Date();
    let sent = 0;
    let skipped = 0;
    for (const c of candidates) {
      if (sent >= MAX_PER_TICK) break;
      const reminderMins = c.reminderMins ?? 30;
      if (reminderMins <= 0) {
        skipped++;
        continue;
      }
      const reminderStart = new Date(c.booking.slotStart.getTime() - reminderMins * 60_000);
      // 進入提醒時刻才發（避免太早）
      if (now < reminderStart) {
        skipped++;
        continue;
      }
      const result = await notifyBookingReminder(c.booking);
      if (result.sent) sent++;
      else skipped++;
    }

    if (sent > 0 || candidates.length > 5) {
      console.log(
        `[booking-reminder-cron] tick: candidates=${candidates.length} sent=${sent} skipped=${skipped}`,
      );
    }
  } catch (err) {
    console.error("[booking-reminder-cron] runOnce 失敗:", err);
  }
}

/**
 * 啟動 cron。重複呼叫安全（不會重複起動）
 */
export function startBookingReminderCron(): void {
  if (timer) return;
  // 啟動延遲 30 秒避免跟 server boot 競爭
  setTimeout(() => {
    runOnce();
    timer = setInterval(runOnce, CRON_INTERVAL_MS);
  }, 30_000);
  console.log("[booking-reminder-cron] 已排程、首次 30 秒後跑、之後每分鐘");
}

/**
 * 停止 cron（測試 / shutdown 用）
 */
export function stopBookingReminderCron(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
