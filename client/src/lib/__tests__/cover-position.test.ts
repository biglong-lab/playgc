// 🧪 cover-position 單元測試
import { describe, it, expect } from "vitest";
import {
  DEFAULT_POSITION,
  formatPosition,
  parsePosition,
  positionFromPointer,
} from "../cover-position";

describe("formatPosition", () => {
  it("正常範圍：50, 50 → '50.0% 50.0%'", () => {
    expect(formatPosition(50, 50)).toBe("50.0% 50.0%");
  });

  it("正常範圍：33.45, 67.89 → 一位小數", () => {
    expect(formatPosition(33.45, 67.89)).toBe("33.5% 67.9%");
  });

  it("clamp 超過 100", () => {
    expect(formatPosition(120, 200)).toBe("100.0% 100.0%");
  });

  it("clamp 負數", () => {
    expect(formatPosition(-50, -10)).toBe("0.0% 0.0%");
  });

  it("邊界值 0/100", () => {
    expect(formatPosition(0, 0)).toBe("0.0% 0.0%");
    expect(formatPosition(100, 100)).toBe("100.0% 100.0%");
  });

  it("處理 NaN / Infinity → fallback 預設", () => {
    expect(formatPosition(NaN, 50)).toBe(DEFAULT_POSITION);
    expect(formatPosition(50, NaN)).toBe(DEFAULT_POSITION);
    expect(formatPosition(Infinity, 50)).toBe(DEFAULT_POSITION);
    expect(formatPosition(50, -Infinity)).toBe(DEFAULT_POSITION);
  });
});

describe("parsePosition", () => {
  it("正常解析", () => {
    expect(parsePosition("30% 70%")).toEqual({ x: 30, y: 70 });
  });

  it("帶小數", () => {
    expect(parsePosition("33.5% 67.9%")).toEqual({ x: 33.5, y: 67.9 });
  });

  it("有空白容錯", () => {
    expect(parsePosition("  30% 70%  ")).toEqual({ x: 30, y: 70 });
    expect(parsePosition("30%   70%")).toEqual({ x: 30, y: 70 });
  });

  it("undefined / null → fallback 50/50", () => {
    expect(parsePosition(undefined)).toEqual({ x: 50, y: 50 });
    expect(parsePosition(null)).toEqual({ x: 50, y: 50 });
  });

  it("空字串 → fallback", () => {
    expect(parsePosition("")).toEqual({ x: 50, y: 50 });
  });

  it("格式錯誤 → fallback", () => {
    expect(parsePosition("invalid")).toEqual({ x: 50, y: 50 });
    expect(parsePosition("30")).toEqual({ x: 50, y: 50 });
    expect(parsePosition("30%")).toEqual({ x: 50, y: 50 });
  });

  it("clamp 超出範圍的合法格式", () => {
    expect(parsePosition("9999% 0%")).toEqual({ x: 100, y: 0 });
  });

  it("非字串輸入（防呆）→ fallback", () => {
    // @ts-expect-error 故意傳錯型別測防呆
    expect(parsePosition(123)).toEqual({ x: 50, y: 50 });
  });
});

describe("positionFromPointer", () => {
  const rect = { left: 100, top: 200, width: 400, height: 300 };

  it("中央點 → 50% 50%", () => {
    expect(positionFromPointer(300, 350, rect)).toBe("50.0% 50.0%");
  });

  it("左上角 → 0% 0%", () => {
    expect(positionFromPointer(100, 200, rect)).toBe("0.0% 0.0%");
  });

  it("右下角 → 100% 100%", () => {
    expect(positionFromPointer(500, 500, rect)).toBe("100.0% 100.0%");
  });

  it("超出容器 → clamp 0/100", () => {
    expect(positionFromPointer(50, 100, rect)).toBe("0.0% 0.0%");
    expect(positionFromPointer(600, 600, rect)).toBe("100.0% 100.0%");
  });

  it("rect 寬高為 0 → fallback 預設（防除零）", () => {
    expect(positionFromPointer(100, 100, { left: 0, top: 0, width: 0, height: 0 })).toBe(
      DEFAULT_POSITION,
    );
  });

  it("rect 寬度 0 → fallback", () => {
    expect(positionFromPointer(100, 100, { left: 0, top: 0, width: 0, height: 100 })).toBe(
      DEFAULT_POSITION,
    );
  });
});

describe("integration: format → parse round-trip", () => {
  it("format → parse 應能還原（允許 0.05 誤差因 toFixed 取整）", () => {
    const cases = [
      [10, 20],
      [33.45, 67.89],
      [0, 100],
      [50, 50],
    ];
    for (const [x, y] of cases) {
      const formatted = formatPosition(x, y);
      const parsed = parsePosition(formatted);
      expect(parsed.x).toBeCloseTo(x, 0);
      expect(parsed.y).toBeCloseTo(y, 0);
    }
  });
});
