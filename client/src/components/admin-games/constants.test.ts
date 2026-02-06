// admin-games/constants.ts 測試
import { describe, it, expect } from "vitest";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  DIFFICULTY_LABELS,
  normalizeStatus,
} from "./constants";

describe("STATUS_LABELS", () => {
  it("應該包含所有狀態標籤", () => {
    expect(STATUS_LABELS.draft).toBe("草稿");
    expect(STATUS_LABELS.published).toBe("已發布");
    expect(STATUS_LABELS.archived).toBe("已封存");
  });

  it("應該有三種狀態", () => {
    expect(Object.keys(STATUS_LABELS)).toHaveLength(3);
  });
});

describe("STATUS_COLORS", () => {
  it("應該包含所有狀態顏色", () => {
    expect(STATUS_COLORS.draft).toContain("yellow");
    expect(STATUS_COLORS.published).toContain("green");
    expect(STATUS_COLORS.archived).toContain("gray");
  });

  it("應該對應所有狀態", () => {
    const statusKeys = Object.keys(STATUS_LABELS);
    const colorKeys = Object.keys(STATUS_COLORS);
    expect(colorKeys).toEqual(expect.arrayContaining(statusKeys));
  });
});

describe("DIFFICULTY_LABELS", () => {
  it("應該包含所有難度標籤", () => {
    expect(DIFFICULTY_LABELS.easy).toBe("簡單");
    expect(DIFFICULTY_LABELS.medium).toBe("中等");
    expect(DIFFICULTY_LABELS.hard).toBe("困難");
  });

  it("應該有三種難度", () => {
    expect(Object.keys(DIFFICULTY_LABELS)).toHaveLength(3);
  });
});

describe("normalizeStatus", () => {
  it("應該返回有效的狀態值", () => {
    expect(normalizeStatus("draft")).toBe("draft");
    expect(normalizeStatus("published")).toBe("published");
    expect(normalizeStatus("archived")).toBe("archived");
  });

  it("應該將 null 轉換為 draft", () => {
    expect(normalizeStatus(null)).toBe("draft");
  });

  it("應該將 undefined 轉換為 draft", () => {
    expect(normalizeStatus(undefined)).toBe("draft");
  });

  it("應該將空字串轉換為 draft", () => {
    expect(normalizeStatus("")).toBe("draft");
  });

  it("應該保留未知狀態值", () => {
    // 這個函式不驗證狀態值，只處理 null/undefined
    expect(normalizeStatus("unknown")).toBe("unknown");
  });
});
