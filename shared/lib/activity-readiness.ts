// 🚦 活動「能不能被預約」判斷（2026-09-24）
//
// 事故：2026-09-24 業主一口氣建了 7 個活動（峰火前線 / 夜幕殺機套裝、老兵回憶錄），
//   封面、文案、價格都填好也啟用了，但沒設時段規則 →
//   客人看到卡片、按「立即預約」只得到「這個活動還沒有設定可預約時段」。
//
// 靠人記得去設時段不可靠，改成系統自己看得出來：
//   後台卡片標警告、前台按鈕停用，不讓客人白按。
import type { BookingScheduleTemplate } from "@shared/schema";

/** 真正會產生梯次的規則：啟用中、而且有時段（slots 空 = 休假日標記）*/
export function bookableRules(template: BookingScheduleTemplate | null | undefined) {
  return (template?.rules ?? []).filter(
    (r) => r.enabled && Array.isArray(r.slots) && r.slots.length > 0,
  );
}

/**
 * 這個活動現在開放預約嗎
 * false = 客人點進去只會看到「還沒有設定可預約時段」
 */
export function isScheduleReady(template: BookingScheduleTemplate | null | undefined): boolean {
  return bookableRules(template).length > 0;
}
