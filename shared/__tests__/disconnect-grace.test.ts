// ⏱️ 斷線寬限期設定規則（前後端共用）：秒、整數、範圍內才有效
import { describe, it, expect } from "vitest";
import { DISCONNECT_GRACE_LIMITS, checkDisconnectGraceSettings } from "../lib/disconnect-grace";

describe("DISCONNECT_GRACE_LIMITS", () => {
  it("寬限 5～600 秒（預設 30）、自動離開 30～600 秒（預設 120）", () => {
    expect(DISCONNECT_GRACE_LIMITS.graceSec).toEqual({ min: 5, max: 600, default: 30 });
    expect(DISCONNECT_GRACE_LIMITS.autoLeaveSec).toEqual({ min: 30, max: 600, default: 120 });
  });
});

describe("checkDisconnectGraceSettings — 設定 API 驗證", () => {
  it("沒帶這兩個欄位 → 通過且不更新", () => {
    expect(checkDisconnectGraceSettings({})).toEqual({ ok: true, values: {} });
  });

  it("合法值 → 通過，四捨五入成整數秒", () => {
    expect(checkDisconnectGraceSettings({ disconnectGracePeriodSec: 45.4, autoLeaveAfterGraceSec: 300 })).toEqual({
      ok: true,
      values: { disconnectGracePeriodSec: 45, autoLeaveAfterGraceSec: 300 },
    });
  });

  it("寬限期超出範圍 → 不通過、繁中說明範圍", () => {
    const r = checkDisconnectGraceSettings({ disconnectGracePeriodSec: 2 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("斷線寬限期需介於 5～600 秒");
  });

  it("自動離開超出範圍 / 非數字 → 不通過", () => {
    const r1 = checkDisconnectGraceSettings({ autoLeaveAfterGraceSec: 601 });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.message).toBe("超時自動離開需介於 30～600 秒");
    expect(checkDisconnectGraceSettings({ autoLeaveAfterGraceSec: "120" }).ok).toBe(false);
  });
});
