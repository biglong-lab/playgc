// AR 貼圖群組 transform 幾何測試 — 驗證預覽 CSS 與 canvas 合成用同一套數學（CHITO AR #1）
import { describe, it, expect } from "vitest";
import { cssGroupTransform, canvasGroupTransform } from "../arStickerTransform";
import { AR_STICKER_IDENTITY } from "../useArStickerGesture";

describe("arStickerTransform 幾何", () => {
  it("identity → 無位移無縮放", () => {
    expect(cssGroupTransform(AR_STICKER_IDENTITY, 300)).toBe("translate(0px, 0px) scale(1)");
    const c = canvasGroupTransform(AR_STICKER_IDENTITY, 400, 800);
    expect(c.translateX).toBe(200); // 中心
    expect(c.translateY).toBe(400);
    expect(c.scale).toBe(1);
  });

  it("CSS 位移 = dx × 短邊（px）", () => {
    expect(cssGroupTransform({ dx: 0.1, dy: -0.2, scale: 1.5 }, 300)).toBe(
      "translate(30px, -60px) scale(1.5)",
    );
  });

  it("canvas 位移以短邊為單位、繞中心縮放", () => {
    // 400x800 → 短邊 400、中心 (200,400)
    const c = canvasGroupTransform({ dx: 0.25, dy: 0.5, scale: 2 }, 400, 800);
    expect(c.translateX).toBe(200 + 0.25 * 400); // 300
    expect(c.translateY).toBe(400 + 0.5 * 400); // 600
    expect(c.scale).toBe(2);
    expect(c.originX).toBe(200);
    expect(c.originY).toBe(400);
  });

  it("預覽與 canvas 用相同 dx/dy 比例 → 位移比例一致（解析度無關）", () => {
    const t = { dx: 0.3, dy: 0, scale: 1 };
    // 預覽短邊 300 → 位移 90px（= 0.3 短邊）
    expect(cssGroupTransform(t, 300)).toBe("translate(90px, 0px) scale(1)");
    // canvas 短邊 600 → 位移相對中心 +180（= 0.3 短邊）比例相同
    const c = canvasGroupTransform(t, 600, 1200);
    expect(c.translateX - c.originX).toBe(0.3 * 600); // 180
  });
});
