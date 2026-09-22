// 📊 POS 報表區間計算（Asia/Taipei）— 本週 / 本月 / 上個月 / 自訂驗證
import { describe, it, expect } from "vitest";
import {
  taipeiToday,
  thisWeek,
  thisMonth,
  lastMonth,
  validateCustomRange,
  formatRangeTitle,
  MAX_RANGE_DAYS,
} from "../pos-report-ranges";

describe("taipeiToday — 以台北時區決定「今天」", () => {
  it("UTC 16:00 已是台北隔天", () => {
    expect(taipeiToday(new Date("2026-08-31T16:30:00Z"))).toBe("2026-09-01");
  });

  it("台北跨年瞬間：UTC 12/31 15:59:59 仍是 12/31、16:00 即 1/1", () => {
    expect(taipeiToday(new Date("2026-12-31T15:59:59Z"))).toBe("2026-12-31");
    expect(taipeiToday(new Date("2026-12-31T16:00:00Z"))).toBe("2027-01-01");
  });
});

describe("lastMonth — 上個月 1 日 ~ 上個月最後一天", () => {
  it("一般月份", () => {
    expect(lastMonth("2026-09-22")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });

  it("跨年：1 月的上個月是去年 12 月", () => {
    expect(lastMonth("2026-01-15")).toEqual({ from: "2025-12-01", to: "2025-12-31" });
    expect(lastMonth("2027-01-01")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("閏年 2 月有 29 天", () => {
    expect(lastMonth("2024-03-10")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(lastMonth("2000-03-01")).toEqual({ from: "2000-02-01", to: "2000-02-29" });
  });

  it("平年 2 月 28 天（含百年非閏）", () => {
    expect(lastMonth("2026-03-31")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(lastMonth("2100-03-15")).toEqual({ from: "2100-02-01", to: "2100-02-28" });
  });

  it("月底日期不溢位：10/31 的上個月是 9/1~9/30（不會跳成 10 月）", () => {
    expect(lastMonth("2026-10-31")).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(lastMonth("2026-05-31")).toEqual({ from: "2026-04-01", to: "2026-04-30" });
  });

  it("月初第一天", () => {
    expect(lastMonth("2026-09-01")).toEqual({ from: "2026-08-01", to: "2026-08-31" });
  });
});

describe("thisWeek — 週一 ~ 今天", () => {
  it("週二 → 回推到週一", () => {
    expect(thisWeek("2026-09-22")).toEqual({ from: "2026-09-21", to: "2026-09-22" });
  });

  it("週一當天 → 起訖同一天", () => {
    expect(thisWeek("2026-09-21")).toEqual({ from: "2026-09-21", to: "2026-09-21" });
  });

  it("週日 → 回推 6 天到週一", () => {
    expect(thisWeek("2026-09-27")).toEqual({ from: "2026-09-21", to: "2026-09-27" });
  });

  it("跨年週：2027-01-01（週五）→ 2026-12-28 起", () => {
    expect(thisWeek("2027-01-01")).toEqual({ from: "2026-12-28", to: "2027-01-01" });
  });
});

describe("thisMonth — 本月 1 日 ~ 今天", () => {
  it("月中", () => {
    expect(thisMonth("2026-09-22")).toEqual({ from: "2026-09-01", to: "2026-09-22" });
  });

  it("1 日當天", () => {
    expect(thisMonth("2026-09-01")).toEqual({ from: "2026-09-01", to: "2026-09-01" });
  });
});

describe("validateCustomRange — 自訂起訖檢查", () => {
  it("合法 → null", () => {
    expect(validateCustomRange("2026-09-01", "2026-09-10")).toBeNull();
    expect(validateCustomRange("2026-09-10", "2026-09-10")).toBeNull();
  });

  it("缺任一日期 → 提示選擇", () => {
    expect(validateCustomRange("", "2026-09-10")).toBe("請選擇起訖日期");
    expect(validateCustomRange("2026-09-01", "")).toBe("請選擇起訖日期");
  });

  it("起 > 訖 → 提示錯誤", () => {
    expect(validateCustomRange("2026-09-10", "2026-09-01")).toBe("起始日不可晚於結束日");
  });

  it("格式錯誤 → 提示", () => {
    expect(validateCustomRange("2026/09/01", "2026-09-10")).toBe("日期格式須為 YYYY-MM-DD");
  });

  it(`超過 ${MAX_RANGE_DAYS} 天 → 提示上限（與後端一致）`, () => {
    expect(MAX_RANGE_DAYS).toBe(366);
    expect(validateCustomRange("2024-01-01", "2024-12-31")).toBeNull();
    expect(validateCustomRange("2025-01-01", "2026-01-02")).toBe("查詢區間最長 366 天");
  });
});

describe("formatRangeTitle", () => {
  it("標籤（起 ~ 訖）", () => {
    expect(formatRangeTitle({ label: "上個月", from: "2026-08-01", to: "2026-08-31" })).toBe(
      "上個月（2026-08-01 ~ 2026-08-31）",
    );
  });
});
