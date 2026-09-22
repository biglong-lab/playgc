// 🚫 後台取消預約原因規則（前後端共用）：必填、去頭尾空白後至少 5 個字
import { describe, it, expect } from "vitest";
import { checkCancelReason, CANCEL_REASON_MIN_LENGTH, CANCEL_REASON_MAX_LENGTH } from "../lib/booking-cancel-reason";

describe("checkCancelReason", () => {
  it("最少 5 個字", () => {
    expect(CANCEL_REASON_MIN_LENGTH).toBe(5);
  });

  it("未填 / 非字串 → 不通過、提示必填", () => {
    for (const raw of [undefined, null, 123, {}]) {
      const r = checkCancelReason(raw);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.message).toBe("請填寫取消原因（至少 5 個字）");
    }
  });

  it("空白字串視同未填", () => {
    const r = checkCancelReason("    ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("請填寫取消原因（至少 5 個字）");
  });

  it("不足 5 個字 → 不通過、說明還差幾個字", () => {
    const r = checkCancelReason("颱風停");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe("取消原因至少 5 個字（還差 2 個字）");
  });

  it("去頭尾空白後計算（空白不算字）", () => {
    expect(checkCancelReason("  颱風停業  ").ok).toBe(false);
    const r = checkCancelReason("  颱風停業中  ");
    expect(r).toEqual({ ok: true, reason: "颱風停業中" });
  });

  it("剛好 5 個字 → 通過", () => {
    expect(checkCancelReason("場地維修中")).toEqual({ ok: true, reason: "場地維修中" });
  });

  it("emoji 以一個字計（不因 UTF-16 被算成兩個）", () => {
    // "😀😀下雨" 的 .length 是 6，但實際只有 4 個字
    expect(checkCancelReason("😀😀下雨").ok).toBe(false);
    expect(checkCancelReason("😀😀下大雨").ok).toBe(true);
  });

  it("超過上限 → 不通過", () => {
    const r = checkCancelReason("字".repeat(CANCEL_REASON_MAX_LENGTH + 1));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain(String(CANCEL_REASON_MAX_LENGTH));
  });
});
