// battle-time 單元測試
// 用固定 now 參數注入避免測試 flaky
import { describe, it, expect } from "vitest";
import { formatTimeUntil, isImminentSlot, formatTimeAgo } from "../battle-time";

describe("formatTimeUntil", () => {
  // 固定參考時間：2026-04-25 12:00
  const baseNow = new Date("2026-04-25T12:00:00");

  describe("錯誤處理", () => {
    it("沒給 slotDate → 回空字串", () => {
      expect(formatTimeUntil(null)).toBe("");
      expect(formatTimeUntil(undefined)).toBe("");
      expect(formatTimeUntil("")).toBe("");
    });

    it("無效 slotDate → 回原值（fallback）", () => {
      // "abc" 在 new Date("abcT00:00:00") 會 NaN
      expect(formatTimeUntil("abc")).toBe("abc");
    });
  });

  describe("⚡ 1 小時內", () => {
    it("5 分鐘後 → ⚡ 5 分鐘後", () => {
      expect(
        formatTimeUntil("2026-04-25", "12:05:00", null, { now: baseNow }),
      ).toBe("⚡ 5 分鐘後");
    });

    it("30 分鐘後 → ⚡ 30 分鐘後", () => {
      expect(
        formatTimeUntil("2026-04-25", "12:30:00", null, { now: baseNow }),
      ).toBe("⚡ 30 分鐘後");
    });

    it("59 分鐘後 → ⚡ 59 分鐘後", () => {
      expect(
        formatTimeUntil("2026-04-25", "12:59:00", null, { now: baseNow }),
      ).toBe("⚡ 59 分鐘後");
    });
  });

  describe("今天/明天", () => {
    it("今天傍晚 → 今天 19:00", () => {
      expect(
        formatTimeUntil("2026-04-25", "19:00:00", null, { now: baseNow }),
      ).toBe("今天 19:00");
    });

    it("明天 → 明天 09:00", () => {
      expect(
        formatTimeUntil("2026-04-26", "09:00:00", null, { now: baseNow }),
      ).toBe("明天 09:00");
    });

    it("3 天後 → 3 天後 14:00", () => {
      expect(
        formatTimeUntil("2026-04-28", "14:00:00", null, { now: baseNow }),
      ).toBe("3 天後 14:00");
    });

    it("7 天後 → MM-DD 格式", () => {
      expect(
        formatTimeUntil("2026-05-02", "10:00:00", null, { now: baseNow }),
      ).toBe("05-02 10:00");
    });
  });

  describe("對戰中 / 已結束", () => {
    it("對戰已開始但未結束 → 對戰中", () => {
      // 11:00 開始 ~ 13:00 結束，現在 12:00 → 對戰中
      expect(
        formatTimeUntil("2026-04-25", "11:00:00", "13:00:00", { now: baseNow }),
      ).toBe("對戰中 · 11:00");
    });

    it("對戰已結束 → 已結束", () => {
      // 09:00 開始 ~ 11:00 結束，現在 12:00 → 已結束
      expect(
        formatTimeUntil("2026-04-25", "09:00:00", "11:00:00", { now: baseNow }),
      ).toBe("已結束");
    });

    it("沒給 endTime 時對戰已開始 → 對戰中（無法判斷已結束）", () => {
      expect(
        formatTimeUntil("2026-04-25", "11:00:00", null, { now: baseNow }),
      ).toBe("對戰中 · 11:00");
    });
  });

  describe("startTime 預設處理", () => {
    it("沒給 startTime → 用 00:00 計算", () => {
      // 2026-04-25 00:00 已經過了（現在 12:00），所以是「對戰中」
      expect(
        formatTimeUntil("2026-04-25", null, null, { now: baseNow }),
      ).toBe("對戰中 · 00:00");
    });
  });
});

describe("isImminentSlot", () => {
  const baseNow = new Date("2026-04-25T12:00:00");

  it("5 分鐘後 → true", () => {
    expect(isImminentSlot("2026-04-25", "12:05:00", { now: baseNow })).toBe(true);
  });

  it("29 分鐘後 → true", () => {
    expect(isImminentSlot("2026-04-25", "12:29:00", { now: baseNow })).toBe(true);
  });

  it("31 分鐘後 → false", () => {
    expect(isImminentSlot("2026-04-25", "12:31:00", { now: baseNow })).toBe(false);
  });

  it("已開始 → false（diffMs < 0）", () => {
    expect(isImminentSlot("2026-04-25", "11:00:00", { now: baseNow })).toBe(false);
  });

  it("缺資料 → false", () => {
    expect(isImminentSlot(null, null)).toBe(false);
    expect(isImminentSlot("2026-04-25", null)).toBe(false);
  });
});

describe("formatTimeAgo", () => {
  const now = new Date("2026-04-25T12:00:00");

  it("< 1 分鐘 → 剛剛", () => {
    const recent = new Date("2026-04-25T11:59:30"); // 30 秒前
    expect(formatTimeAgo(recent, { now })).toBe("剛剛");
  });

  it("整 1 分鐘前 → 1 分鐘前", () => {
    const oneMin = new Date("2026-04-25T11:59:00");
    expect(formatTimeAgo(oneMin, { now })).toBe("1 分鐘前");
  });

  it("59 分鐘前 → 59 分鐘前", () => {
    const fiftyNineMin = new Date("2026-04-25T11:01:00");
    expect(formatTimeAgo(fiftyNineMin, { now })).toBe("59 分鐘前");
  });

  it("1 小時前 → 1 小時前", () => {
    const oneHour = new Date("2026-04-25T11:00:00");
    expect(formatTimeAgo(oneHour, { now })).toBe("1 小時前");
  });

  it("23 小時前 → 23 小時前", () => {
    const twentyThreeHr = new Date("2026-04-24T13:00:00");
    expect(formatTimeAgo(twentyThreeHr, { now })).toBe("23 小時前");
  });

  it("1 天前 → 1 天前", () => {
    const oneDay = new Date("2026-04-24T12:00:00");
    expect(formatTimeAgo(oneDay, { now })).toBe("1 天前");
  });

  it("29 天前 → 29 天前", () => {
    const twentyNineDays = new Date("2026-03-27T12:00:00");
    expect(formatTimeAgo(twentyNineDays, { now })).toBe("29 天前");
  });

  it("2 個月前 → 2 個月前", () => {
    const twoMonths = new Date("2026-02-15T12:00:00");
    expect(formatTimeAgo(twoMonths, { now })).toBe("2 個月前");
  });

  it("超過 12 個月 → 顯示年", () => {
    const oneYear = new Date("2025-04-25T12:00:00"); // 12 個月前
    expect(formatTimeAgo(oneYear, { now })).toBe("1 年前");
  });

  it("未來時間 → 「剛剛」（不顯示負數）", () => {
    const future = new Date("2026-04-25T13:00:00");
    expect(formatTimeAgo(future, { now })).toBe("剛剛");
  });
});
