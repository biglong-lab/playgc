// 🚦 2026-09-24 事故：一口氣建了 7 個活動（峰火前線 / 夜幕殺機套裝、老兵回憶錄），
//   封面文案價格都填好也啟用了，卻沒設時段規則 →
//   客人看得到卡片、按「立即預約」只得到「這個活動還沒有設定可預約時段」。
//   這支鎖住「系統自己看得出來還沒開放」。
import { describe, it, expect } from "vitest";
import { isScheduleReady, bookableRules } from "@shared/lib/activity-readiness";
import type { BookingScheduleTemplate } from "@shared/schema";

const rule = (over: Record<string, unknown> = {}) => ({
  id: "r", name: "規則", priority: 0, enabled: true,
  applyTo: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
  slots: [{ startTime: "14:00", endTime: "18:00", intervalMinutes: 30, gameDurationMinutes: 30, capacity: 12 }],
  ...over,
});
const template = (rules: unknown[]) => ({ rules } as unknown as BookingScheduleTemplate);

describe("活動是否已開放預約", () => {
  it("🐛 新建活動沒設任何時段 → 未開放", () => {
    expect(isScheduleReady(null)).toBe(false);
    expect(isScheduleReady(undefined)).toBe(false);
    expect(isScheduleReady(template([]))).toBe(false);
  });

  it("規則存在但全部停用 → 未開放", () => {
    expect(isScheduleReady(template([rule({ enabled: false })]))).toBe(false);
  });

  it("規則只剩休假日標記（slots 空）→ 未開放", () => {
    expect(isScheduleReady(template([rule({ slots: [] })]))).toBe(false);
  });

  it("有一條啟用中且有時段的規則 → 已開放", () => {
    expect(isScheduleReady(template([rule({ enabled: false }), rule({ id: "ok" })]))).toBe(true);
  });

  it("bookableRules 只回真正會產生梯次的規則", () => {
    const t = template([rule({ id: "a" }), rule({ id: "b", enabled: false }), rule({ id: "c", slots: [] })]);
    expect(bookableRules(t).map((r) => r.id)).toEqual(["a"]);
  });
});
