// 🐛 2026-09-24 業主回報：後台設了「日間 14:30-17:30」與「夜間 19:00-20:00」，
//   前台只顯示夜間 2 梯 → 同一天的多條規則被當成互相覆蓋，第二段整個消失。
//   業主的用法是「一天可以有好幾段開放時間」→ 同層級規則要取聯集。
import { describe, it, expect } from "vitest";
import { getDailySlots, resolveRulesForDate } from "../schedule-resolver";
import type { BookingScheduleTemplate } from "@shared/schema";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function rule(name: string, startTime: string, endTime: string, opts: {
  weekdays?: number[]; priority?: number; enabled?: boolean; capacity?: number;
} = {}) {
  return {
    id: name,
    name,
    priority: opts.priority ?? 0,
    enabled: opts.enabled ?? true,
    applyTo: { weekdays: opts.weekdays ?? ALL_DAYS },
    slots: [{
      startTime, endTime, intervalMinutes: 30, capacity: opts.capacity ?? 12, gameDurationMinutes: 30,
    }],
  };
}

/** 2026-09-25 是週五 */
const WEEKDAY = new Date(2026, 8, 25);
const startTimes = (slots: { startAt: Date }[]) =>
  slots.map((s) => `${String(s.startAt.getHours()).padStart(2, "0")}:${String(s.startAt.getMinutes()).padStart(2, "0")}`);

describe("同一天多條規則", () => {
  it("🐛 回歸：日間 + 夜間兩條規則 → 兩段時段都要出現（原本只剩夜間）", () => {
    const template: BookingScheduleTemplate = {
      rules: [rule("日間", "14:30", "16:00"), rule("夜間", "19:00", "20:00")],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["14:30", "15:00", "15:30", "19:00", "19:30"]);
  });

  it("時段重疊的重複梯次只出現一次，人數取大的", () => {
    const template: BookingScheduleTemplate = {
      rules: [
        rule("假日時段", "13:00", "14:00", { capacity: 8 }),
        rule("一般時段", "13:00", "14:00", { capacity: 20 }),
      ],
    } as BookingScheduleTemplate;
    const slots = getDailySlots(template, WEEKDAY);
    expect(startTimes(slots)).toEqual(["13:00", "13:30"]);
    expect(slots[0].capacity).toBe(20);
  });

  it("照開始時間排序（後加的早上時段不會跑到最後）", () => {
    const template: BookingScheduleTemplate = {
      rules: [rule("晚", "19:00", "20:00"), rule("早", "10:00", "11:00")],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["10:00", "10:30", "19:00", "19:30"]);
  });

  it("priority 仍是覆蓋機制：高優先權那層獨占（假日特例蓋掉平常設定）", () => {
    const template: BookingScheduleTemplate = {
      rules: [
        rule("平常", "14:00", "15:00"),
        rule("特例", "09:00", "10:00", { priority: 1 }),
      ],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["09:00", "09:30"]);
    expect(resolveRulesForDate(template, WEEKDAY).map((r) => r.name)).toEqual(["特例"]);
  });

  it("同優先權的多條特例規則也會合併", () => {
    const template: BookingScheduleTemplate = {
      rules: [
        rule("平常", "14:00", "15:00"),
        rule("特例早", "09:00", "10:00", { priority: 1 }),
        rule("特例晚", "21:00", "22:00", { priority: 1 }),
      ],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["09:00", "09:30", "21:00", "21:30"]);
  });

  it("停用的規則不算；當天沒有規則 → 沒有時段", () => {
    const template: BookingScheduleTemplate = {
      rules: [rule("日間", "14:30", "15:30"), rule("夜間", "19:00", "20:00", { enabled: false })],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["14:30", "15:00"]);
    expect(getDailySlots({ rules: [rule("週末", "10:00", "11:00", { weekdays: [0, 6] })] } as BookingScheduleTemplate, WEEKDAY)).toEqual([]);
  });

  it("平日規則 + 只在週末的規則 → 週五只出現平日那段", () => {
    const template: BookingScheduleTemplate = {
      rules: [
        rule("平日", "14:30", "15:30", { weekdays: [1, 2, 3, 4, 5] }),
        rule("假日", "10:30", "11:30", { weekdays: [0, 6] }),
      ],
    } as BookingScheduleTemplate;
    expect(startTimes(getDailySlots(template, WEEKDAY))).toEqual(["14:30", "15:00"]);
  });
});
