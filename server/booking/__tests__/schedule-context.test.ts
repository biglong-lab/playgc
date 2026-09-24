// 🐛 2026-09-24 業主回報：新活動的時段在玩家端顯示「可預約」，按下去卻說「該時段不在開放時段內」
//
// 根因：顯示時段用「活動排程」、建立預約卻只驗「場域預設排程」→ 兩邊來源分岔。
//   這支測試鎖住排程來源的優先序（活動 > 場域預設），兩邊都用它就不會再分岔。
import { describe, it, expect, vi, beforeEach } from "vitest";

const { state, mockDb } = vi.hoisted(() => {
  const state = {
    field: { id: "field-uuid", code: "JIACHUN" } as unknown,
    config: { isEnabled: true, scheduleTemplate: { rules: [{ id: "field-rule" }] } } as unknown,
    activity: undefined as unknown,
    activitySchedule: undefined as unknown,
    calls: [] as string[],
  };
  /** 依「這次 select 的是哪張表」回對應資料（用 from() 傳入的識別字串判斷） */
  const mockDb = {
    select: vi.fn(() => ({
      from: vi.fn((table: { _name?: string }) => {
        const name = table?._name ?? "unknown";
        state.calls.push(name);
        const rows =
          name === "fields" ? [state.field]
            : name === "bookingConfigs" ? (state.config ? [state.config] : [])
              : name === "activities" ? (state.activity ? [state.activity] : [])
                : name === "activitySchedules" ? (state.activitySchedule ? [state.activitySchedule] : [])
                  : [];
        const result = Promise.resolve(rows.filter(Boolean));
        return { where: vi.fn(() => ({ limit: vi.fn(() => result), then: (r: (v: unknown) => void) => result.then(r) })) };
      }),
    })),
  };
  return { state, mockDb };
});

vi.mock("../../db", () => ({ db: mockDb }));
vi.mock("@shared/schema", () => ({
  fields: { _name: "fields", id: "id", code: "code" },
  bookingConfigs: { _name: "bookingConfigs", fieldId: "field_id" },
  bookings: { _name: "bookings", activityId: "activity_id", fieldId: "field_id", slotStart: "slot_start", status: "status", partySize: "party_size" },
  activities: { _name: "activities", id: "id", capacityPerSlot: "capacity_per_slot" },
  activitySchedules: { _name: "activitySchedules", activityId: "activity_id", scheduleTemplate: "schedule_template" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(), and: vi.fn(), gte: vi.fn(), lte: vi.fn(), ne: vi.fn(), inArray: vi.fn(), isNull: vi.fn(),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}));

import { resolveScheduleContext } from "../booking-service";

const ACTIVITY_TEMPLATE = { rules: [{ id: "activity-rule" }] };

beforeEach(() => {
  vi.clearAllMocks();
  state.calls = [];
  state.field = { id: "field-uuid", code: "JIACHUN" };
  state.config = { isEnabled: true, scheduleTemplate: { rules: [{ id: "field-rule" }] } };
  state.activity = { capacity: 12 };
  state.activitySchedule = { template: ACTIVITY_TEMPLATE };
});

describe("resolveScheduleContext（顯示時段與建立預約共用）", () => {
  it("活動有自己的排程 → 用活動排程 + 活動每梯人數", async () => {
    const ctx = await resolveScheduleContext("field-uuid", "act-1");
    expect(ctx).toMatchObject({ ok: true, template: ACTIVITY_TEMPLATE, capacityOverride: 12 });
  });

  it("🐛 回歸：場域預設排程是空的，活動照樣能預約（這就是預約失敗的根因）", async () => {
    state.config = { isEnabled: true, scheduleTemplate: { rules: [] } };
    const ctx = await resolveScheduleContext("field-uuid", "act-1");
    expect(ctx).toMatchObject({ ok: true, template: ACTIVITY_TEMPLATE });
  });

  it("活動沒設排程 → 不偷用場域預設，明確回「活動還沒設定時段」", async () => {
    state.activitySchedule = undefined;
    expect(await resolveScheduleContext("field-uuid", "act-1")).toEqual({
      ok: false,
      reason: "activity_no_schedule",
    });
  });

  it("沒掛活動的預約（舊資料 / 單一時間表場域）→ 才用場域預設", async () => {
    const ctx = await resolveScheduleContext("field-uuid");
    expect(ctx).toMatchObject({ ok: true, template: { rules: [{ id: "field-rule" }] } });
    expect((ctx as { capacityOverride?: number }).capacityOverride).toBeUndefined();
    expect(state.calls).not.toContain("activities");
  });

  it("場域總開關關閉 / 沒開通預約 → 活動也一起關（唯一保留的關聯）", async () => {
    state.config = { isEnabled: false, scheduleTemplate: {} };
    expect(await resolveScheduleContext("field-uuid", "act-1")).toEqual({ ok: false, reason: "booking_disabled" });
    state.config = undefined;
    expect(await resolveScheduleContext("field-uuid")).toEqual({ ok: false, reason: "booking_disabled" });
  });
});
