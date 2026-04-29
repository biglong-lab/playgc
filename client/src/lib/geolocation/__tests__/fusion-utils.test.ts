// 🤝 多人 GPS 融合單元測試
import { describe, it, expect } from "vitest";
import { fuseTeamGps, type FusionSample } from "../fusion-utils";

const NOW = Date.now();

function sample(
  userId: string,
  lat: number,
  lng: number,
  accuracy: number,
  ageMs: number = 0,
): FusionSample {
  return { userId, lat, lng, accuracy, timestamp: NOW - ageMs };
}

describe("fuseTeamGps", () => {
  describe("散開檢測", () => {
    it("隊友超過 50m → 不融合，回傳自己位置", () => {
      const me = sample("me", 25.033, 121.565, 10);
      // 隊友離 70m+
      const teammate = sample("a", 25.034, 121.566, 10);
      const r = fuseTeamGps(me, [teammate]);
      expect(r.scattered).toBe(true);
      expect(r.lat).toBe(me.lat);
      expect(r.lng).toBe(me.lng);
      expect(r.contributors).toBe(1);
    });

    it("隊友 < 50m → 進行融合", () => {
      const me = sample("me", 25.033, 121.565, 20);
      // 隊友差 0.0001 ≈ 11m，在範圍內
      const teammate = sample("a", 25.0331, 121.5651, 15);
      const r = fuseTeamGps(me, [teammate]);
      expect(r.scattered).toBe(false);
      expect(r.contributors).toBe(2);
    });
  });

  describe("過時樣本過濾", () => {
    it("> 10 秒前的樣本被丟棄", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const stale = sample("a", 25.0331, 121.5651, 10, 15_000); // 15 秒前
      const r = fuseTeamGps(me, [stale]);
      // 樣本數不足（只剩自己） → 不融合
      expect(r.contributors).toBe(1);
    });

    it("10 秒內的樣本保留", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const fresh = sample("a", 25.0331, 121.5651, 10, 5_000); // 5 秒前
      const r = fuseTeamGps(me, [fresh]);
      expect(r.contributors).toBe(2);
    });
  });

  describe("反方差加權平均", () => {
    it("精度好的樣本權重大", () => {
      // 兩點距離 ~30m（在 50m 散開閾值內）
      const me = sample("me", 25.033, 121.565, 50); // 精度差
      const a = sample("a", 25.0331, 121.5653, 5); // 精度好
      const r = fuseTeamGps(me, [a]);
      expect(r.scattered).toBe(false);
      // 反方差加權：a 精度 5 → 權重 1/25，me 精度 50 → 權重 1/2500
      // a 權重大 100 倍 → 融合結果幾乎等於 a 的座標
      expect(r.lat).toBeCloseTo(a.lat, 4);
      expect(r.lng).toBeCloseTo(a.lng, 4);
    });

    it("融合後 accuracy < 自己的 accuracy", () => {
      const me = sample("me", 25.033, 121.565, 30);
      const a = sample("a", 25.0331, 121.5651, 25);
      const b = sample("b", 25.0329, 121.5649, 28);
      const r = fuseTeamGps(me, [a, b]);
      expect(r.scattered).toBe(false);
      expect(r.accuracy).toBeLessThan(me.accuracy);
    });

    it("contributors 大於 1 時 improvementRatio > 0", () => {
      const me = sample("me", 25.033, 121.565, 30);
      const a = sample("a", 25.0331, 121.5651, 25);
      const b = sample("b", 25.0329, 121.5649, 28);
      const r = fuseTeamGps(me, [a, b]);
      expect(r.improvementRatio).toBeGreaterThan(0);
      expect(r.improvementRatio).toBeLessThanOrEqual(1);
    });
  });

  describe("自己的樣本", () => {
    it("teamSamples 包含自己 userId 也會被過濾掉", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const dup = sample("me", 25.5, 121.5, 5); // 雖在 teamSamples 但 userId 同自己 → 被過濾
      const r = fuseTeamGps(me, [dup]);
      expect(r.contributors).toBe(1);
      expect(r.lat).toBe(25.033); // 沒被 dup 影響
    });
  });

  describe("空隊伍", () => {
    it("teamSamples 空陣列 → 不融合", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const r = fuseTeamGps(me, []);
      expect(r.contributors).toBe(1);
      expect(r.scattered).toBe(false);
      expect(r.lat).toBe(me.lat);
      expect(r.improvementRatio).toBe(0);
    });
  });

  describe("無效樣本過濾", () => {
    it("accuracy 0 的樣本被丟棄", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const invalid = sample("a", 25.0331, 121.5651, 0);
      const r = fuseTeamGps(me, [invalid]);
      expect(r.contributors).toBe(1);
    });

    it("accuracy 負數被丟棄", () => {
      const me = sample("me", 25.033, 121.565, 20);
      const invalid = sample("a", 25.0331, 121.5651, -5);
      const r = fuseTeamGps(me, [invalid]);
      expect(r.contributors).toBe(1);
    });
  });
});
