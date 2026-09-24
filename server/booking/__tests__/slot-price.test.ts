// 💰 2026-09-24：時段規則設的價格要真的收到
//
// 業主在「定點射擊」設日間 NT$249、夜間 NT$349，
// 但後端計價只讀活動基價（activities.price_cents = 24900）→ 夜間每人少收 100 元。
// 這支鎖住「哪一梯就收哪一梯的價」。
import { describe, it, expect } from "vitest";
import { getDailySlots, expandSlotWindow } from "../schedule-resolver";
import type { BookingScheduleTemplate } from "@shared/schema";

const WINDOW = {
  startTime: "14:30", endTime: "16:30",
  intervalMinutes: 60, gameDurationMinutes: 60, capacity: 12,
};

const dayRule = {
  id: "day", name: "平日定點射擊", priority: 0, enabled: true,
  applyTo: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
  slots: [WINDOW],
  pricePerSlotCentsOverride: 24900,
};
const nightRule = {
  id: "night", name: "夜間定點射擊", priority: 0, enabled: true,
  applyTo: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
  slots: [{ ...WINDOW, startTime: "19:00", endTime: "21:00" }],
  pricePerSlotCentsOverride: 34900,
};

const template = (rules: unknown[]) => ({ rules } as unknown as BookingScheduleTemplate);
const WEDNESDAY = new Date(2026, 8, 30); // 2026-09-30

describe("每一梯帶自己的價格", () => {
  it("🐛 同一天日間 249、夜間 349 → 各梯價格不同（不是全部 249）", () => {
    const slots = getDailySlots(template([dayRule, nightRule]), WEDNESDAY);
    const byHour = new Map(slots.map((s) => [s.startAt.getHours(), s.priceCents]));
    expect(byHour.get(14)).toBe(24900);
    expect(byHour.get(15)).toBe(24900);
    expect(byHour.get(19)).toBe(34900);
    expect(byHour.get(20)).toBe(34900);
  });

  it("規則沒設價 → priceCents undefined（由呼叫端套活動基價）", () => {
    const noPrice = { ...dayRule, pricePerSlotCentsOverride: undefined };
    const slots = getDailySlots(template([noPrice]), WEDNESDAY);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.priceCents === undefined)).toBe(true);
  });

  it("expandSlotWindow 把價格帶到每一梯", () => {
    const slots = expandSlotWindow(WEDNESDAY, WINDOW, undefined, 34900);
    expect(slots).toHaveLength(2);
    expect(slots.every((s) => s.priceCents === 34900)).toBe(true);
  });

  it("容量覆寫與價格覆寫互不干擾", () => {
    const slots = expandSlotWindow(WEDNESDAY, WINDOW, 8, 34900);
    expect(slots[0]).toMatchObject({ capacity: 8, priceCents: 34900 });
  });
});
