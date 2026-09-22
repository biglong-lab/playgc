// 📊 POS 報表區間計算（2026-09-22）
//
// 純函式、一律以 Asia/Taipei 為準。「今天」以 YYYY-MM-DD 字串注入（預設 taipeiToday()），
// 日期運算只用 UTC 欄位，避免瀏覽器所在時區 / 夏令時間影響結果。

/** 與後端 server/lib/pos-report-range.ts 一致：單次查詢最長 366 天（含頭尾） */
export const MAX_RANGE_DAYS = 366;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

export interface LabeledRange extends DateRange {
  readonly label: string;
}

/** Asia/Taipei 的今天 YYYY-MM-DD；可注入 now 以便測試 */
export function taipeiToday(now: Date = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

/** YYYY-MM-DD → UTC 午夜 Date（純日期運算用） */
function toUtcDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function fmtUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** 本週：週一 ~ 今天 */
export function thisWeek(today: string = taipeiToday()): DateRange {
  const d = toUtcDate(today);
  const offset = (d.getUTCDay() + 6) % 7; // 週一 = 0
  return { from: fmtUtc(new Date(d.getTime() - offset * MS_PER_DAY)), to: today };
}

/** 本月：本月 1 日 ~ 今天 */
export function thisMonth(today: string = taipeiToday()): DateRange {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

/** 上個月：上個月 1 日 ~ 上個月最後一天（1 月 → 去年 12 月） */
export function lastMonth(today: string = taipeiToday()): DateRange {
  const [y, m] = today.split("-").map(Number);
  // Date.UTC 的 month 為 0 起算：(y, m-2, 1) = 上個月 1 日；(y, m-1, 0) = 本月 0 日 = 上個月最後一天
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  return { from: fmtUtc(first), to: fmtUtc(last) };
}

/** 自訂起訖檢查；合法回 null，否則回繁中錯誤訊息 */
export function validateCustomRange(from: string, to: string): string | null {
  if (!from || !to) return "請選擇起訖日期";
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) return "日期格式須為 YYYY-MM-DD";
  if (from > to) return "起始日不可晚於結束日";
  const days = Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / MS_PER_DAY) + 1;
  if (days > MAX_RANGE_DAYS) return `查詢區間最長 ${MAX_RANGE_DAYS} 天`;
  return null;
}

/** 區間標題：「上個月（2026-08-01 ~ 2026-08-31）」 */
export function formatRangeTitle(range: LabeledRange): string {
  return `${range.label}（${range.from} ~ ${range.to}）`;
}
