// 兩種座標系的旋轉規則守護（CHITO 2a1bb97a：地圖誤用裝置相對角度）
import { describe, it, expect } from "vitest";
import {
  normalizeDeg,
  deviceRelativeAngle,
  worldAbsoluteAngle,
} from "@/lib/compass-rotation";

describe("normalizeDeg", () => {
  it("負角與超過 360 都回到 [0,360)", () => {
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(450)).toBe(90);
    expect(normalizeDeg(360)).toBe(0);
  });
});

describe("deviceRelativeAngle（羅盤：螢幕上方=裝置前方）", () => {
  it("目標正北、面向北 → 正前方 0°", () => {
    expect(deviceRelativeAngle(0, 0)).toBe(0);
  });

  it("目標正北、面向東(90) → 目標在左手邊 270°", () => {
    expect(deviceRelativeAngle(0, 90)).toBe(270);
  });

  it("實測案例：朝向 270(西)、目標方位 21 → 相對 111（向右轉 111°）", () => {
    expect(deviceRelativeAngle(21, 270)).toBe(111);
  });

  it("無羅盤 → fallback 絕對方位", () => {
    expect(deviceRelativeAngle(21, null)).toBe(21);
  });
});

describe("worldAbsoluteAngle（地圖：北朝上、不隨裝置轉）", () => {
  it("不減 heading — 朝向 270 時地圖箭頭就是 270", () => {
    expect(worldAbsoluteAngle(270)).toBe(270);
  });

  it("目標方位 21 → 地圖上就指 21（不是 111）", () => {
    expect(worldAbsoluteAngle(21)).toBe(21);
    expect(worldAbsoluteAngle(21)).not.toBe(deviceRelativeAngle(21, 270));
  });

  it("無羅盤 → null（呼叫端不畫朝向箭頭）", () => {
    expect(worldAbsoluteAngle(null)).toBeNull();
  });
});
