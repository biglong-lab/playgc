// 🧠 P3 智慧分流單元測試
import { describe, it, expect } from "vitest";
import { normalize, levenshtein, matchAnswer } from "../text-match";

describe("text-match: normalize", () => {
  it("去除中文標點", () => {
    expect(normalize("台灣，最高山！是？玉山。")).toBe("台灣最高山是玉山");
  });

  it("全形數字 → 半形", () => {
    expect(normalize("１２３")).toBe("123");
  });

  it("英文小寫化", () => {
    expect(normalize("HELLO")).toBe("hello");
  });

  it("空白處理", () => {
    expect(normalize("  hello world  ")).toBe("helloworld");
  });
});

describe("text-match: levenshtein", () => {
  it("相同字串 → 0", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });

  it("一字之差 → 1", () => {
    expect(levenshtein("abc", "abd")).toBe(1);
  });

  it("中文一字之差 → 1", () => {
    expect(levenshtein("台灣", "臺灣")).toBe(1);
  });

  it("空字串", () => {
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("abc", "")).toBe(3);
  });
});

describe("text-match: matchAnswer", () => {
  it("Layer 1 exact: 完全符合 → 100 分", () => {
    const r = matchAnswer("玉山", ["玉山"]);
    expect(r.match).toBe(true);
    expect(r.layer).toBe("exact");
    expect(r.score).toBe(100);
    expect(r.matchedAnswer).toBe("玉山");
  });

  it("Layer 1 exact: 標點冗餘 → 仍命中", () => {
    const r = matchAnswer("玉山。。。", ["玉山"]);
    expect(r.match).toBe(true);
    expect(r.layer).toBe("exact");
  });

  it("Layer 1 exact: 全形數字 vs 半形 → 命中", () => {
    const r = matchAnswer("１２３", ["123"]);
    expect(r.match).toBe(true);
    expect(r.layer).toBe("exact");
  });

  it("Layer 2 fuzzy: 一字之差 → 90 分", () => {
    const r = matchAnswer("台灣", ["臺灣"]);
    expect(r.match).toBe(true);
    expect(r.layer).toBe("fuzzy");
    expect(r.score).toBe(90);
    expect(r.distance).toBe(1);
  });

  it("Layer 2 fuzzy: 距離 ≤ 2 → 命中", () => {
    const r = matchAnswer("玉山峰", ["玉山"], { fuzzyTolerance: 2 });
    expect(r.match).toBe(true);
    expect(r.layer).toBe("fuzzy");
  });

  it("Layer 3 ai_needed: 距離 > 2 → 不中", () => {
    const r = matchAnswer("阿里山是台灣最美的", ["玉山"], { fuzzyTolerance: 2 });
    expect(r.match).toBe(false);
    expect(r.layer).toBe("ai_needed");
  });

  it("多個參考答案：取最近的", () => {
    const r = matchAnswer("玉山", ["阿里山", "玉山", "雪山"]);
    expect(r.match).toBe(true);
    expect(r.layer).toBe("exact");
    expect(r.matchedAnswer).toBe("玉山");
  });

  it("禁用 fuzzy → 只走 exact", () => {
    const r = matchAnswer("台灣", ["臺灣"], { enableFuzzy: false });
    expect(r.match).toBe(false);
    expect(r.layer).toBe("ai_needed");
  });

  it("空答案 → ai_needed", () => {
    const r = matchAnswer("", ["玉山"]);
    expect(r.match).toBe(false);
    expect(r.layer).toBe("ai_needed");
  });
});
