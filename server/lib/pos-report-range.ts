// 📊 POS 區間報表 from/to 解析與驗證（2026-09-22）
//
// 純函式：不碰 DB、「今天」由呼叫端注入，方便測試。
// 規則：YYYY-MM-DD 且為真實日期、from <= to、最長 MAX_POS_RANGE_DAYS 天。
// 未帶參數沿用舊行為：to 預設今天、from 預設 = to。

/** 單次區間查詢上限（含頭尾），防大範圍掃表拖垮 DB；366 = 閏年整年 */
export const MAX_POS_RANGE_DAYS = 366;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;

export type PosRangeResult =
  | { ok: true; from: string; to: string; days: number }
  | { ok: false; message: string };

/** 是否為真實存在的 YYYY-MM-DD（擋 2026-02-30、2026-13-01） */
export function isValidIsoDate(value: string): boolean {
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/** 含頭尾的天數（from=to 為 1 天） */
export function inclusiveDays(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  return Math.round((b - a) / MS_PER_DAY) + 1;
}

/** 單一 query 值：undefined → 未帶；非字串（重複參數變陣列）→ 視為格式錯誤 */
function readParam(raw: unknown): { value?: string; bad: boolean } {
  if (raw === undefined || raw === "") return { bad: false };
  if (typeof raw !== "string") return { bad: true };
  return { value: raw, bad: false };
}

/** 解析 ?from=&to=；失敗回繁中訊息 */
export function resolvePosReportRange(
  query: { from?: unknown; to?: unknown },
  today: string,
): PosRangeResult {
  const fromParam = readParam(query.from);
  const toParam = readParam(query.to);
  if (fromParam.bad || toParam.bad) {
    return { ok: false, message: "日期參數格式錯誤，須為 YYYY-MM-DD" };
  }
  const to = toParam.value ?? today;
  const from = fromParam.value ?? to;
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) {
    return { ok: false, message: "日期格式須為 YYYY-MM-DD 且為有效日期" };
  }
  if (from > to) return { ok: false, message: "起始日不可晚於結束日" };
  const days = inclusiveDays(from, to);
  if (days > MAX_POS_RANGE_DAYS) {
    return { ok: false, message: `查詢區間最長 ${MAX_POS_RANGE_DAYS} 天（目前 ${days} 天）` };
  }
  return { ok: true, from, to, days };
}
