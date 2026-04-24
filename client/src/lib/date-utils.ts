// 📅 日期共用工具
//
// 目前主要用於公告倒數顯示（Dashboard、/admin/fields、CHITO 首頁場域卡三處）

/**
 * 計算從今天到指定日期還剩幾天（含當天）
 * @param isoDate ISO 格式 YYYY-MM-DD；null/undefined 或格式錯誤回傳 null
 * @returns 正數 = 未來天數，0 = 今日，負數 = 已過期，null = 無法計算
 */
export function daysUntilDate(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(isoDate);
    end.setHours(0, 0, 0, 0);
    if (Number.isNaN(end.getTime())) return null;
    const diff = end.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
}

/**
 * 把剩餘天數轉成適合顯示的繁體中文文案
 * - >1 天：「剩 N 天」
 * - 1 天：「明天下架」
 * - 0 天：「今日最後」
 * - <0 天（已過期）或 null：回傳 null（呼叫端決定要不要顯示「已過期」）
 */
export function formatRemainingDays(days: number | null): string | null {
  if (days === null) return null;
  if (days > 1) return `剩 ${days} 天`;
  if (days === 1) return "明天下架";
  if (days === 0) return "今日最後";
  return null;
}

/**
 * 便利 wrapper：直接從 ISO 日期字串得到顯示文案
 */
export function formatCountdown(isoDate: string | null | undefined): string | null {
  return formatRemainingDays(daysUntilDate(isoDate));
}
