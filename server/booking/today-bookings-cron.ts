// 今日預約晨報 cron（2026-06-13）
//
// 每天早上 08:00（Asia/Taipei）把「今日預約清單」推到場域群組（賈村）。
// 只針對 TELEGRAM_GAME_NOTIFY_FIELD_ID 指定場域；沒設則不跑。
// 群組 chat_id 由 TELEGRAM_FIELD_GROUP_CHAT_IDS 控制（internal-notifier）。
//
// 啟動位置：server/index.ts startup

import { db } from "../db";
import { bookings, activities, fields } from "@shared/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import { notifyTodayBookings } from "../lib/internal-notifier";

const CHECK_INTERVAL_MS = 60_000; // 每分鐘檢查是否到點
const TARGET_HOUR = 8; // 08:00 Taipei
const TARGET_MINUTE = 0;

let timer: NodeJS.Timeout | null = null;
let lastRunDate: string | null = null;

/** 取得 Asia/Taipei 的 {hour, minute, dateStr} */
function taipeiNow(): { hour: number; minute: number; dateStr: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    dateStr: `${parts.year}-${parts.month}-${parts.day}`,
  };
}

async function runOnce(dateStr: string): Promise<void> {
  const fieldId = process.env.TELEGRAM_GAME_NOTIFY_FIELD_ID;
  if (!fieldId) return;

  // 🐛 2026-06-24 修復：bookings.field_id 歷史上混存 UUID 或 code → 須同時比對兩者
  //   （與 resolveFieldScope 同慣例），否則只用 UUID 過濾會漏掉存 code 的預約。
  const [field] = await db.select({ id: fields.id, code: fields.code }).from(fields).where(or(eq(fields.id, fieldId), eq(fields.code, fieldId))).limit(1);
  const identifiers = Array.from(new Set([fieldId, field?.id, field?.code].filter(Boolean) as string[]));

  // 今日（Taipei）confirmed/pending 預約，依時間排序
  const rows = await db
    .select({
      slotStart: bookings.slotStart,
      displayName: bookings.displayName,
      partySize: bookings.partySize,
      activityName: activities.name,
    })
    .from(bookings)
    .leftJoin(activities, eq(activities.id, bookings.activityId))
    .where(
      and(
        inArray(bookings.fieldId, identifiers),
        sql`${bookings.status} IN ('confirmed', 'pending')`,
        sql`(${bookings.slotStart} AT TIME ZONE 'Asia/Taipei')::date = (NOW() AT TIME ZONE 'Asia/Taipei')::date`,
      ),
    )
    .orderBy(bookings.slotStart);

  notifyTodayBookings({
    dateLabel: dateStr,
    bookings: rows.map((r) => ({
      timeStr: new Date(r.slotStart).toLocaleString("zh-TW", {
        timeZone: "Asia/Taipei",
        hour: "2-digit",
        minute: "2-digit",
      }),
      displayName: r.displayName || "(未填名)",
      partySize: r.partySize ?? 0,
      activityName: r.activityName ?? undefined,
    })),
  });
}

function tick(): void {
  const { hour, minute, dateStr } = taipeiNow();
  if (hour === TARGET_HOUR && minute === TARGET_MINUTE && lastRunDate !== dateStr) {
    lastRunDate = dateStr;
    runOnce(dateStr).catch((err) => console.error("[today-bookings-cron] runOnce 失敗:", err));
  }
}

export function startTodayBookingsCron(): void {
  if (timer) return;
  console.log(
    `[today-bookings-cron] cron started, will run daily at ${String(TARGET_HOUR).padStart(2, "0")}:${String(TARGET_MINUTE).padStart(2, "0")} (Asia/Taipei)`,
  );
  timer = setInterval(tick, CHECK_INTERVAL_MS);
}
