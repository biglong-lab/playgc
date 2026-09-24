// 💰 2026-09-24 業主回報：活動卡片只顯示 NT$249，但夜間場其實收 NT$349
import { describe, it, expect } from "vitest";
import { getPriceRange, formatPriceRange, formatNT } from "@shared/lib/booking-price";
import type { BookingScheduleTemplate } from "@shared/schema";

const rule = (over: Partial<BookingScheduleTemplate["rules"][number]>) => ({
  id: "r", name: "規則", priority: 0, enabled: true,
  applyTo: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
  slots: [{ startTime: "14:30", endTime: "17:30", intervalMinutes: 30, gameDurationMinutes: 30, capacity: 12 }],
  ...over,
});

const template = (rules: unknown[]) => ({ rules } as unknown as BookingScheduleTemplate);

describe("活動價格區間", () => {
  it("🐛 日間 249 / 夜間 349 → 區間 249-349（不是只有 249）", () => {
    const t = template([
      rule({ id: "day", pricePerSlotCentsOverride: 24900 }),
      rule({ id: "night", pricePerSlotCentsOverride: 34900 }),
    ]);
    const range = getPriceRange(t, 24900);
    expect(range).toEqual({ minCents: 24900, maxCents: 34900, hasRange: true });
    expect(formatPriceRange(range)).toBe("NT$249 - NT$349");
  });

  it("規則沒設價 → 用活動基價（不會變成 0）", () => {
    const t = template([rule({ id: "a" }), rule({ id: "b", pricePerSlotCentsOverride: 34900 })]);
    expect(getPriceRange(t, 24900)).toEqual({ minCents: 24900, maxCents: 34900, hasRange: true });
  });

  it("全部同價 → 照舊顯示單一價格", () => {
    const t = template([
      rule({ id: "a", pricePerSlotCentsOverride: 24900 }),
      rule({ id: "b", pricePerSlotCentsOverride: 24900 }),
    ]);
    const range = getPriceRange(t, 24900);
    expect(range.hasRange).toBe(false);
    expect(formatPriceRange(range)).toBe("NT$249");
  });

  it("停用的規則不算（關掉夜間就不該再顯示到 349）", () => {
    const t = template([
      rule({ id: "day", pricePerSlotCentsOverride: 24900 }),
      rule({ id: "night", pricePerSlotCentsOverride: 34900, enabled: false }),
    ]);
    expect(getPriceRange(t, 24900).hasRange).toBe(false);
  });

  it("休假日規則（slots 空）不算價格", () => {
    const t = template([
      rule({ id: "day", pricePerSlotCentsOverride: 24900 }),
      rule({ id: "off", pricePerSlotCentsOverride: 999900, slots: [] }),
    ]);
    expect(getPriceRange(t, 24900).maxCents).toBe(24900);
  });

  it("沒有排程的活動 → 就是活動基價", () => {
    expect(getPriceRange(null, 26900)).toEqual({ minCents: 26900, maxCents: 26900, hasRange: false });
  });

  it("金額格式：千分位", () => {
    expect(formatNT(129900)).toBe("NT$1,299");
  });
});
