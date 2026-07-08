// 🧭 alphaToCompassHeading 單元測試（CHITO #c92e32dc GPS 指向標第 9 修）
import { describe, it, expect } from "vitest";
import { alphaToCompassHeading } from "../useCompassHeading";

describe("alphaToCompassHeading（absolute alpha → 順時針指北方位）", () => {
  it("alpha=0（手機頂朝北）→ 方位 0°", () => {
    expect(alphaToCompassHeading(0, 0)).toBe(0);
  });

  it("alpha=270（絕對 alpha 逆時針 270 = 手機頂朝東）→ 方位 90°", () => {
    expect(alphaToCompassHeading(270, 0)).toBe(90);
  });

  it("alpha=90 → 方位 270°（朝西）", () => {
    expect(alphaToCompassHeading(90, 0)).toBe(270);
  });

  it("alpha=180 → 方位 180°（朝南）", () => {
    expect(alphaToCompassHeading(180, 0)).toBe(180);
  });

  it("手機順時針轉（往東）→ alpha 遞減 → 方位遞增（0→30→60）", () => {
    // 玩家往東轉 30°：alpha 從 0 → 330 → 300
    expect(alphaToCompassHeading(330, 0)).toBe(30);
    expect(alphaToCompassHeading(300, 0)).toBe(60);
  });

  it("螢幕橫向（90°）補償", () => {
    expect(alphaToCompassHeading(0, 90)).toBe(90);
    expect(alphaToCompassHeading(270, 90)).toBe(180);
  });

  it("結果永遠落在 0-359", () => {
    for (const alpha of [0, 45, 90, 180, 359.9]) {
      for (const screen of [0, 90, 180, 270]) {
        const h = alphaToCompassHeading(alpha, screen);
        expect(h).toBeGreaterThanOrEqual(0);
        expect(h).toBeLessThan(360);
      }
    }
  });
});

describe("指向標整體公式驗證（screenAngle = targetBearing − heading）", () => {
  const arrowAngle = (targetBearing: number, heading: number) =>
    (targetBearing - heading + 360) % 360;

  it("面向目標（heading=bearing）→ 箭頭朝正上（0°）", () => {
    expect(arrowAngle(90, 90)).toBe(0);
  });

  it("目標在正東（90°）、玩家面北 → 箭頭指右（90°）", () => {
    expect(arrowAngle(90, 0)).toBe(90);
  });

  it("玩家往東（順時針）轉 30° → 箭頭逆時針回轉 30°（持續指向真實目標）", () => {
    // 目標正北：heading 0→30，箭頭 0→330（= −30°，往左修正）
    expect(arrowAngle(0, 30)).toBe(330);
  });
});
