// 預約時段解析器
//
// 給定 fieldId + 日期、回傳該日的可預約 slot 列表（含已預約人數）。
//
// 解析優先序：
//   1. blackoutDates 包含 X → 完全關閉
//   2. 過濾 enabled rules 中 applyTo match X 的
//   3. 取 priority 最高者（同 priority 取最後新增）
//   4. 若無 rule match → 此天不開放
//   5. rule 的 slots 為空 → 此天關閉（業主主動標記休假）
//
// 國定假日：簡易實作（先寫死 2026 國定假日；之後可串外部 calendar API）

import type {
  BookingApplyRange,
  BookingRule,
  BookingScheduleTemplate,
  BookingSlotWindow,
} from "@shared/schema";

// 2026 中華民國國定假日（簡易內建表、可從 admin 後台維護或串外部 API）
const TW_HOLIDAYS_2026 = new Set([
  "2026-01-01", // 元旦
  "2026-02-15", "2026-02-16", "2026-02-17", "2026-02-18", "2026-02-19", // 春節
  "2026-02-28", // 和平紀念日
  "2026-04-04", "2026-04-05", "2026-04-06", // 兒童節 + 清明
  "2026-05-01", // 勞動節
  "2026-06-19", "2026-06-20", // 端午
  "2026-09-25", // 中秋
  "2026-10-09", "2026-10-10", // 國慶
]);

/**
 * 該日是否國定假日
 */
export function isHoliday(date: Date): boolean {
  const ymd = formatYMD(date);
  return TW_HOLIDAYS_2026.has(ymd);
}

/**
 * 格式化日期為 YYYY-MM-DD（local time）
 */
export function formatYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * 判斷某日是否落在 dateRange 內（含端點）
 */
function isInDateRange(ymd: string, range: { from: string; to: string }): boolean {
  return ymd >= range.from && ymd <= range.to;
}

/**
 * 判斷某日是否符合規則的 applyTo
 */
export function matchesApplyRange(date: Date, applyTo: BookingApplyRange): boolean {
  const ymd = formatYMD(date);

  // 1. 特定日期 match
  if (applyTo.specificDates?.includes(ymd)) return true;

  // 2. 日期區間 match
  if (applyTo.dateRanges?.some((r) => isInDateRange(ymd, r))) return true;

  // 3. 週天 match（含國定假日視為週末邏輯）
  if (applyTo.weekdays && applyTo.weekdays.length > 0) {
    let dow = date.getDay(); // 0=週日, 6=週六
    if (applyTo.treatHolidaysAsWeekend && isHoliday(date)) {
      // 視為週日（0）來 match weekday=[0,6] 之類的假日 rule
      dow = dow === 6 ? 6 : 0;
    }
    if (applyTo.weekdays.includes(dow)) return true;
  }

  return false;
}

/**
 * 解析給定日期的有效規則
 *
 * @param template schedule template
 * @param date 目標日期
 * @returns 套用的規則（null = 此日不開放）
 */
export function resolveRuleForDate(
  template: BookingScheduleTemplate,
  date: Date,
): BookingRule | null {
  const ymd = formatYMD(date);

  // 1. blackoutDates 直接關閉
  if (template.blackoutDates?.includes(ymd)) return null;

  // 2. 過濾 enabled + match applyTo 的 rules
  const matched = template.rules.filter(
    (rule) => rule.enabled && matchesApplyRange(date, rule.applyTo),
  );
  if (matched.length === 0) return null;

  // 3. priority 最高者（同 priority 取陣列尾、視為「後加蓋舊」）
  const sorted = [...matched].sort((a, b) => {
    if (a.priority !== b.priority) return b.priority - a.priority;
    return template.rules.indexOf(b) - template.rules.indexOf(a);
  });
  return sorted[0] ?? null;
}

/**
 * 展開 slot window 為實際時段列表
 *
 * 例：startTime="14:00", endTime="18:00", intervalMinutes=30, gameDurationMinutes=30
 *   → [14:00-14:30, 14:30-15:00, 15:00-15:30, 15:30-16:00,
 *      16:00-16:30, 16:30-17:00, 17:00-17:30, 17:30-18:00]
 */
export interface ExpandedSlot {
  startAt: Date;     // 此梯次開始時間
  endAt: Date;       // 此梯次結束時間
  capacity: number;  // 此梯次容量
}

export function expandSlotWindow(
  date: Date,
  window: BookingSlotWindow,
  capacityOverride?: number,
): ExpandedSlot[] {
  const result: ExpandedSlot[] = [];
  const baseY = date.getFullYear();
  const baseM = date.getMonth();
  const baseD = date.getDate();

  const [startH, startM] = window.startTime.split(":").map((s) => parseInt(s, 10));
  const [endH, endM] = window.endTime.split(":").map((s) => parseInt(s, 10));

  const startAt = new Date(baseY, baseM, baseD, startH, startM, 0, 0);
  const endAt = new Date(baseY, baseM, baseD, endH, endM, 0, 0);

  let cursor = new Date(startAt);
  while (true) {
    const slotEnd = new Date(cursor.getTime() + window.gameDurationMinutes * 60_000);
    if (slotEnd > endAt) break;

    result.push({
      startAt: new Date(cursor),
      endAt: slotEnd,
      capacity: capacityOverride ?? window.capacity,
    });

    cursor = new Date(cursor.getTime() + window.intervalMinutes * 60_000);
  }

  return result;
}

// ── 時段關閉 / 包場（closures）解析（2026-07-02）──────────

/** HH:mm 格式化 Date（local）*/
function toHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 取某日所有 closures */
export function getClosuresForDate(
  template: BookingScheduleTemplate,
  ymd: string,
): BookingClosure[] {
  return (template.closures ?? []).filter((c) => c.date === ymd);
}

/** 某日是否整日關閉（full_day closure 或舊 blackoutDate）*/
export function hasFullDayClosure(
  template: BookingScheduleTemplate,
  ymd: string,
): boolean {
  if (template.blackoutDates?.includes(ymd)) return true;
  return getClosuresForDate(template, ymd).some((c) => c.scope === "full_day");
}

/** slot 是否落在某日 time_range closure 內（時間有重疊即關閉）*/
export function isSlotClosed(
  template: BookingScheduleTemplate,
  ymd: string,
  slot: ExpandedSlot,
): boolean {
  const sStart = toHHMM(slot.startAt);
  const sEnd = toHHMM(slot.endAt);
  return getClosuresForDate(template, ymd).some((c) => {
    if (c.scope !== "time_range" || !c.startTime || !c.endTime) return false;
    // 區間重疊：slotStart < closureEnd && slotEnd > closureStart
    return sStart < c.endTime && sEnd > c.startTime;
  });
}

/**
 * 取得某日的所有 expanded slots（不含已預約人數）
 * 🆕 2026-07-02：套用 closures — 整日關閉回 []，time_range 關閉過濾掉重疊梯次
 */
export function getDailySlots(
  template: BookingScheduleTemplate,
  date: Date,
): ExpandedSlot[] {
  const ymd = formatYMD(date);
  const rule = resolveRuleForDate(template, date);
  if (!rule || rule.slots.length === 0) return [];

  // 整日關閉（full_day closure；blackoutDates 已在 resolveRuleForDate 擋掉）
  if (hasFullDayClosure(template, ymd)) return [];

  const slots = rule.slots.flatMap((window) =>
    expandSlotWindow(date, window, rule.capacityOverride),
  );
  // 過濾與 time_range closure 重疊的梯次
  return slots.filter((s) => !isSlotClosed(template, ymd, s));
}

/**
 * 取得日期區間內的所有 expanded slots（按日整理）
 *
 * 用於 admin dashboard 月曆視圖、客戶預約頁日期選擇
 */
export function getSlotsInRange(
  template: BookingScheduleTemplate,
  fromDate: Date,
  toDate: Date,
): { date: string; slots: ExpandedSlot[] }[] {
  const result: { date: string; slots: ExpandedSlot[] }[] = [];
  const cursor = new Date(fromDate);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(toDate);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const slots = getDailySlots(template, cursor);
    result.push({ date: formatYMD(cursor), slots });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
