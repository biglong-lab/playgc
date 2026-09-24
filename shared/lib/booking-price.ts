// 💰 活動價格區間（2026-09-24）
//
// 業主回報：「定點射擊」日間 NT$249、夜間 NT$349，卡片卻一律顯示 NT$249，
//   客人以為晚上也是 249。
//
// 時段規則本來就能各自設價（BookingRule.pricePerSlotCentsOverride），
// 這支把「這個活動實際會收多少」算出來，給卡片顯示用（後端計價見 booking-service）。
import type { BookingScheduleTemplate } from "@shared/schema";

export interface PriceRange {
  minCents: number;
  maxCents: number;
  /** 有沒有多種價格（false → 照舊顯示單一價）*/
  hasRange: boolean;
}

/**
 * 掃所有「開放中」的規則，算出這個活動的價格區間
 * - 規則有設價 → 用規則的
 * - 規則沒設價 → 用活動基價
 * - slots 空的規則 = 休假日標記，不計入
 */
export function getPriceRange(
  template: BookingScheduleTemplate | null | undefined,
  basePriceCents: number,
): PriceRange {
  const rules = (template?.rules ?? []).filter(
    (r) => r.enabled && Array.isArray(r.slots) && r.slots.length > 0,
  );
  if (rules.length === 0) {
    return { minCents: basePriceCents, maxCents: basePriceCents, hasRange: false };
  }
  const prices = rules.map((r) =>
    typeof r.pricePerSlotCentsOverride === "number" ? r.pricePerSlotCentsOverride : basePriceCents,
  );
  const minCents = Math.min(...prices);
  const maxCents = Math.max(...prices);
  return { minCents, maxCents, hasRange: minCents !== maxCents };
}

/** NT$ 顯示（分 → 元，四捨五入） */
export function formatNT(cents: number): string {
  return `NT$${Math.round(cents / 100).toLocaleString("zh-TW")}`;
}

/**
 * 卡片上的價格字串
 * 單一價格 → 「NT$249」／多種價格 → 「NT$249 - NT$349」
 */
export function formatPriceRange(range: PriceRange): string {
  return range.hasRange
    ? `${formatNT(range.minCents)} - ${formatNT(range.maxCents)}`
    : formatNT(range.minCents);
}
