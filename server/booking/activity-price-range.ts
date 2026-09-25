// 💰 活動價格區間查詢（2026-09-24）
//
// 活動卡片要顯示「NT$249 - NT$349」而不是只有基價，
// 需要把各活動的時段規則一起撈出來算。列表頁一次撈完、避免 N+1。
import { inArray } from "drizzle-orm";
import { db } from "../db";
import { activitySchedules } from "@shared/schema";
import type { BookingScheduleTemplate } from "@shared/schema";
import { getPriceRange, type PriceRange } from "@shared/lib/booking-price";
import { isScheduleReady } from "@shared/lib/activity-readiness";

export interface WithPriceRange {
  priceRange: PriceRange;
  /**
   * 🚦 現在開放預約嗎（false = 沒設時段規則，客人按了只會看到「還沒設定時段」）
   * 後台用來標警告、前台用來停用按鈕。
   */
  scheduleReady: boolean;
}

/** 一次補上多個活動的價格區間與可預約狀態（沒有排程的活動 → 就是基價、不可預約） */
export async function attachPriceRanges<T extends { id: string; priceCents: number }>(
  rows: T[],
): Promise<(T & WithPriceRange)[]> {
  if (rows.length === 0) return [];
  const schedules = await db
    .select({
      activityId: activitySchedules.activityId,
      template: activitySchedules.scheduleTemplate,
    })
    .from(activitySchedules)
    .where(inArray(activitySchedules.activityId, rows.map((r) => r.id)));

  const byActivity = new Map<string, BookingScheduleTemplate>();
  for (const s of schedules) {
    byActivity.set(s.activityId, s.template as BookingScheduleTemplate);
  }
  return rows.map((row) => {
    const template = byActivity.get(row.id);
    return {
      ...row,
      priceRange: getPriceRange(template, row.priceCents),
      scheduleReady: isScheduleReady(template),
    };
  });
}

/** 單一活動的價格區間與可預約狀態 */
export async function attachPriceRange<T extends { id: string; priceCents: number }>(
  row: T,
): Promise<T & WithPriceRange> {
  const [withRange] = await attachPriceRanges([row]);
  return withRange;
}
