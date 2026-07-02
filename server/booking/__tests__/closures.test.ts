// 時段關閉 / 包場 測試（2026-07-02）
// 驗證 schedule-resolver 的 closure 過濾 + closure-service 的驗證/蓋章
import { describe, it, expect } from "vitest";
import { getDailySlots, formatYMD } from "../schedule-resolver";
import { validateAndStampClosures, ClosureValidationError } from "../closure-service";
import type { BookingScheduleTemplate } from "@shared/schema";

// 每日 09:00-18:00、每梯 60 分、間隔 60 分 → 09,10,...,17（9 梯）
const baseTemplate: BookingScheduleTemplate = {
  rules: [
    {
      id: "r1",
      name: "平日",
      priority: 0,
      enabled: true,
      applyTo: { weekdays: [0, 1, 2, 3, 4, 5, 6] },
      slots: [
        { startTime: "09:00", endTime: "18:00", intervalMinutes: 60, capacity: 10, gameDurationMinutes: 60 },
      ],
    },
  ],
};

// 固定用一個平日（2026-07-06 週一）
const DAY = new Date(2026, 6, 6);
const YMD = formatYMD(DAY);

function startHours(slots: { startAt: Date }[]): number[] {
  return slots.map((s) => s.startAt.getHours());
}

describe("schedule-resolver — closures 過濾", () => {
  it("無 closure → 09..17 共 9 梯", () => {
    const slots = getDailySlots(baseTemplate, DAY);
    expect(startHours(slots)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("full_day closure → 當天 0 梯", () => {
    const t: BookingScheduleTemplate = {
      ...baseTemplate,
      closures: [{ id: "c1", date: YMD, scope: "full_day", type: "holiday", reason: "休館" }],
    };
    expect(getDailySlots(t, DAY)).toEqual([]);
  });

  it("time_range 包場 14:00-17:00 → 只 14/15/16 消失、其他保留", () => {
    const t: BookingScheduleTemplate = {
      ...baseTemplate,
      closures: [
        { id: "c1", date: YMD, scope: "time_range", startTime: "14:00", endTime: "17:00", type: "private_booking", reason: "水彈包場" },
      ],
    };
    // 14:00-15:00, 15:00-16:00, 16:00-17:00 與 [14,17) 重疊 → 移除；17:00 起不重疊 → 保留
    expect(startHours(getDailySlots(t, DAY))).toEqual([9, 10, 11, 12, 13, 17]);
  });

  it("time_range closure 只影響指定日期，別天不受影響", () => {
    const t: BookingScheduleTemplate = {
      ...baseTemplate,
      closures: [
        { id: "c1", date: "2026-07-07", scope: "time_range", startTime: "14:00", endTime: "17:00", type: "event", reason: "活動" },
      ],
    };
    expect(startHours(getDailySlots(t, DAY))).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
  });

  it("舊 blackoutDates 仍關整天（相容）", () => {
    const t: BookingScheduleTemplate = { ...baseTemplate, blackoutDates: [YMD] };
    expect(getDailySlots(t, DAY)).toEqual([]);
  });
});

describe("closure-service — 驗證 + 蓋章", () => {
  const actor = { id: "admin-1", displayName: "阿明", username: "ming" };

  it("reason 空 → 丟 ClosureValidationError", () => {
    const t: BookingScheduleTemplate = {
      rules: [],
      closures: [{ id: "c1", date: "2026-07-06", scope: "full_day", type: "holiday", reason: "  " }],
    };
    expect(() => validateAndStampClosures(t, actor)).toThrow(ClosureValidationError);
  });

  it("time_range 起訖不合法（start>=end）→ 丟錯", () => {
    const t: BookingScheduleTemplate = {
      rules: [],
      closures: [{ id: "c1", date: "2026-07-06", scope: "time_range", startTime: "17:00", endTime: "14:00", type: "private_booking", reason: "包場" }],
    };
    expect(() => validateAndStampClosures(t, actor)).toThrow(/結束時間/);
  });

  it("新 closure → 蓋章設定帳號 + 時間，newClosureCount=1", () => {
    const t: BookingScheduleTemplate = {
      rules: [],
      closures: [{ id: "c1", date: "2026-07-06", scope: "full_day", type: "holiday", reason: " 休館 " }],
    };
    const { template, newClosureCount } = validateAndStampClosures(t, actor);
    const c = template.closures![0];
    expect(newClosureCount).toBe(1);
    expect(c.createdByAdminId).toBe("admin-1");
    expect(c.createdByName).toBe("阿明");
    expect(c.createdAt).toBeTruthy();
    expect(c.reason).toBe("休館"); // trim
  });

  it("既有 closure（已蓋章）→ 不覆寫、不計入 newCount", () => {
    const t: BookingScheduleTemplate = {
      rules: [],
      closures: [{ id: "c1", date: "2026-07-06", scope: "full_day", type: "holiday", reason: "舊", createdByAdminId: "admin-0", createdByName: "老王", createdAt: "2026-07-01T00:00:00.000Z" }],
    };
    const { template, newClosureCount } = validateAndStampClosures(t, actor);
    expect(newClosureCount).toBe(0);
    expect(template.closures![0].createdByName).toBe("老王");
  });

  it("displayName 為 null → 用 username", () => {
    const t: BookingScheduleTemplate = {
      rules: [],
      closures: [{ id: "c1", date: "2026-07-06", scope: "full_day", type: "other", reason: "x" }],
    };
    const { template } = validateAndStampClosures(t, { id: "a2", displayName: null, username: "user2" });
    expect(template.closures![0].createdByName).toBe("user2");
  });
});
