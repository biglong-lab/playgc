// 地圖工具函式測試
import { describe, it, expect } from "vitest";
import {
  calculateDistance,
  calculateBearing,
  bearingToDirection,
  calculateNavigation,
  getPageTypeIcon,
} from "./map-utils";

describe("calculateDistance", () => {
  it("同一點距離為 0", () => {
    expect(calculateDistance(25.033, 121.565, 25.033, 121.565)).toBe(0);
  });

  it("計算兩點間距離（台北 101 到台北車站 約 3.4km）", () => {
    const distance = calculateDistance(25.0339, 121.5645, 25.0478, 121.5170);
    expect(distance).toBeGreaterThan(3000);
    expect(distance).toBeLessThan(6000);
  });

  it("計算短距離（約 100m）", () => {
    // 約 0.001 度 ≈ 111m
    const distance = calculateDistance(25.033, 121.565, 25.034, 121.565);
    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(150);
  });

  it("處理負座標（南半球）", () => {
    const distance = calculateDistance(-33.8688, 151.2093, -33.8568, 151.2153);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(2000);
  });
});

describe("calculateBearing", () => {
  it("正北方約 0 度", () => {
    const bearing = calculateBearing(25.0, 121.0, 26.0, 121.0);
    expect(bearing).toBeGreaterThanOrEqual(0);
    expect(bearing).toBeLessThan(5);
  });

  it("正東方約 90 度", () => {
    const bearing = calculateBearing(25.0, 121.0, 25.0, 122.0);
    expect(bearing).toBeGreaterThan(85);
    expect(bearing).toBeLessThan(95);
  });

  it("正南方約 180 度", () => {
    const bearing = calculateBearing(26.0, 121.0, 25.0, 121.0);
    expect(bearing).toBeGreaterThan(175);
    expect(bearing).toBeLessThan(185);
  });

  it("正西方約 270 度", () => {
    const bearing = calculateBearing(25.0, 122.0, 25.0, 121.0);
    expect(bearing).toBeGreaterThan(265);
    expect(bearing).toBeLessThan(275);
  });
});

describe("bearingToDirection", () => {
  it("0 度 → 北", () => {
    expect(bearingToDirection(0)).toBe("北");
  });

  it("45 度 → 東北", () => {
    expect(bearingToDirection(45)).toBe("東北");
  });

  it("90 度 → 東", () => {
    expect(bearingToDirection(90)).toBe("東");
  });

  it("180 度 → 南", () => {
    expect(bearingToDirection(180)).toBe("南");
  });

  it("270 度 → 西", () => {
    expect(bearingToDirection(270)).toBe("西");
  });

  it("350 度 → 北（接近 360）", () => {
    expect(bearingToDirection(350)).toBe("北");
  });

  it("360 度 → 北", () => {
    expect(bearingToDirection(360)).toBe("北");
  });
});

describe("calculateNavigation", () => {
  it("回傳完整導航資訊", () => {
    const nav = calculateNavigation(25.033, 121.565, 25.034, 121.565);
    expect(nav).toHaveProperty("distance");
    expect(nav).toHaveProperty("bearing");
    expect(nav).toHaveProperty("direction");
    expect(nav).toHaveProperty("estimatedTime");
    expect(typeof nav.distance).toBe("number");
    expect(typeof nav.direction).toBe("string");
  });

  it("距離為整數", () => {
    const nav = calculateNavigation(25.033, 121.565, 25.034, 121.566);
    expect(nav.distance).toBe(Math.round(nav.distance));
  });

  it("預估時間合理（步行速度約 5km/h）", () => {
    // 500m 約需 6 分鐘
    const nav = calculateNavigation(25.033, 121.565, 25.0375, 121.565);
    expect(nav.estimatedTime).toBeGreaterThanOrEqual(1);
    expect(nav.estimatedTime).toBeLessThan(20);
  });
});

describe("getPageTypeIcon", () => {
  it("qr_scan → 📱", () => {
    expect(getPageTypeIcon("qr_scan")).toBe("📱");
  });

  it("shooting_mission → 🎯", () => {
    expect(getPageTypeIcon("shooting_mission")).toBe("🎯");
  });

  it("photo_mission → 📷", () => {
    expect(getPageTypeIcon("photo_mission")).toBe("📷");
  });

  it("gps_mission → 📍", () => {
    expect(getPageTypeIcon("gps_mission")).toBe("📍");
  });

  it("未知類型 → 📌", () => {
    expect(getPageTypeIcon("unknown")).toBe("📌");
  });

  it("time_bomb → 💣", () => {
    expect(getPageTypeIcon("time_bomb")).toBe("💣");
  });
});
