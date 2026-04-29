// 🌐 GPS 工具單元測試
// 對應 client/src/lib/geolocation/geo-utils.ts
import { describe, it, expect } from "vitest";
import {
  distanceMeters,
  bearingDegrees,
  bearingToCompass,
  formatDistance,
  classifyAccuracy,
  describeQuality,
  median,
} from "../geo-utils";

describe("distanceMeters (Haversine)", () => {
  it("同一點 → 0 公尺", () => {
    expect(distanceMeters(25.033, 121.565, 25.033, 121.565)).toBe(0);
  });

  it("台北 101 → 台中車站 ≈ 133 km（Haversine 對球面假設誤差約 0.5%）", () => {
    // 台北 101 (25.0330, 121.5645) → 台中車站 (24.1369, 120.6859)
    const d = distanceMeters(25.033, 121.5645, 24.1369, 120.6859);
    expect(d).toBeGreaterThan(130_000);
    expect(d).toBeLessThan(140_000);
  });

  it("回傳的是公尺，不是公里（重要！避免 PhotoSpotFlow ×1000 bug）", () => {
    // 兩個經緯度差 0.001 ≈ 110 公尺
    const d = distanceMeters(25.0, 121.0, 25.001, 121.0);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  it("經度差 0.001 在赤道附近 ≈ 111 公尺", () => {
    const d = distanceMeters(0, 0, 0, 0.001);
    expect(d).toBeGreaterThan(105);
    expect(d).toBeLessThan(115);
  });
});

describe("bearingDegrees", () => {
  it("正北方位 = 0 度", () => {
    const b = bearingDegrees(25.0, 121.0, 25.001, 121.0);
    expect(b).toBeCloseTo(0, 0);
  });

  it("正東方位 = 90 度", () => {
    const b = bearingDegrees(25.0, 121.0, 25.0, 121.001);
    expect(b).toBeCloseTo(90, 0);
  });

  it("正南方位 = 180 度", () => {
    const b = bearingDegrees(25.0, 121.0, 24.999, 121.0);
    expect(b).toBeCloseTo(180, 0);
  });

  it("正西方位 = 270 度", () => {
    const b = bearingDegrees(25.0, 121.0, 25.0, 120.999);
    expect(b).toBeCloseTo(270, 0);
  });
});

describe("bearingToCompass", () => {
  it("0 度 → 北", () => {
    expect(bearingToCompass(0)).toBe("北");
  });
  it("45 度 → 東北", () => {
    expect(bearingToCompass(45)).toBe("東北");
  });
  it("90 度 → 東", () => {
    expect(bearingToCompass(90)).toBe("東");
  });
  it("180 度 → 南", () => {
    expect(bearingToCompass(180)).toBe("南");
  });
  it("270 度 → 西", () => {
    expect(bearingToCompass(270)).toBe("西");
  });
  it("360 度（= 0）→ 北", () => {
    expect(bearingToCompass(360)).toBe("北");
  });
});

describe("formatDistance", () => {
  it("< 1m → 已抵達", () => {
    expect(formatDistance(0.5)).toBe("已抵達");
  });
  it("< 100m → 整數公尺", () => {
    expect(formatDistance(45.7)).toBe("46 公尺");
  });
  it("100-1000m → 10 公尺取整", () => {
    expect(formatDistance(347)).toBe("350 公尺");
  });
  it("> 1km → 公里 + 1 位小數", () => {
    expect(formatDistance(1234)).toBe("1.2 公里");
    expect(formatDistance(15000)).toBe("15.0 公里");
  });
});

describe("classifyAccuracy", () => {
  it("null → unusable", () => {
    expect(classifyAccuracy(null)).toBe("unusable");
  });
  it("undefined → unusable", () => {
    expect(classifyAccuracy(undefined)).toBe("unusable");
  });
  it("≤ 10m → excellent", () => {
    expect(classifyAccuracy(5)).toBe("excellent");
    expect(classifyAccuracy(10)).toBe("excellent");
  });
  it("≤ 30m → good", () => {
    expect(classifyAccuracy(20)).toBe("good");
  });
  it("≤ 50m → fair", () => {
    expect(classifyAccuracy(40)).toBe("fair");
  });
  it("≤ 100m → poor", () => {
    expect(classifyAccuracy(75)).toBe("poor");
  });
  it("> 100m → unusable", () => {
    expect(classifyAccuracy(200)).toBe("unusable");
  });
});

describe("describeQuality", () => {
  it("excellent / good 不需要 hint", () => {
    expect(describeQuality("excellent").hint).toBeUndefined();
    expect(describeQuality("good").hint).toBeUndefined();
  });
  it("fair 有「建議移到開闊處」hint", () => {
    expect(describeQuality("fair").hint).toContain("開闊處");
  });
  it("poor 有「室內 / 暖機」hint", () => {
    const desc = describeQuality("poor");
    expect(desc.hint).toBeTruthy();
    expect(desc.hint).toMatch(/室內|暖機/);
  });
  it("unusable 有 WiFi / 定位 hint", () => {
    const desc = describeQuality("unusable");
    expect(desc.hint).toMatch(/WiFi|定位/);
  });
  it("每個等級都有 emoji + label + color", () => {
    const levels = ["excellent", "good", "fair", "poor", "unusable"] as const;
    for (const l of levels) {
      const d = describeQuality(l);
      expect(d.emoji).toBeTruthy();
      expect(d.label).toBeTruthy();
      expect(d.color).toBeTruthy();
    }
  });
});

describe("median", () => {
  it("空陣列 → 0", () => {
    expect(median([])).toBe(0);
  });
  it("單元素 → 該元素", () => {
    expect(median([42])).toBe(42);
  });
  it("奇數個元素", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("偶數個元素 → 中間兩個平均", () => {
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("不修改原陣列", () => {
    const arr = [3, 1, 2];
    median(arr);
    expect(arr).toEqual([3, 1, 2]); // 原順序保留
  });
  it("過濾離群值（GPS 跳點場景）", () => {
    // 5 個樣本：4 個正常 25.033 附近，1 個離群 25.5
    const lats = [25.033, 25.0331, 25.0329, 25.0332, 25.5];
    const m = median(lats);
    expect(m).toBeCloseTo(25.0331, 3); // 中位數不受 25.5 影響
  });
});
