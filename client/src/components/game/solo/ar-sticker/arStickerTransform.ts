// AR 貼圖群組 transform 幾何 — 讓「預覽 CSS」與「拍照 canvas 合成」用同一套數學
// （ProPlan CHITO AR #1：拖曳/縮放後拍出來的照片要跟預覽一致）
//
// 模型（與 CSS `transform: translate(T) scale(S)` + transform-origin:center 對齊）：
//   點 P → (O + T) + S*(P − O)，O = 中心、T = (dx*短邊, dy*短邊)、S = scale
//   dx/dy 以「短邊比例」表示 → 預覽與 canvas 解析度無關、可直接共用。
import type { ArStickerTransform } from "./useArStickerGesture";

/** 預覽用：回傳套在固定貼圖群組 wrapper 上的 CSS transform 字串 */
export function cssGroupTransform(t: ArStickerTransform, shortSidePx: number): string {
  const tx = t.dx * shortSidePx;
  const ty = t.dy * shortSidePx;
  return `translate(${tx}px, ${ty}px) scale(${t.scale})`;
}

/** canvas 用：回傳 translate/scale/origin 參數（純函式、可單元測試）*/
export function canvasGroupTransform(
  t: ArStickerTransform,
  canvasW: number,
  canvasH: number,
): { translateX: number; translateY: number; scale: number; originX: number; originY: number } {
  const short = Math.min(canvasW, canvasH);
  const originX = canvasW / 2;
  const originY = canvasH / 2;
  return {
    translateX: originX + t.dx * short,
    translateY: originY + t.dy * short,
    scale: t.scale,
    originX,
    originY,
  };
}

/** 把群組 transform 套進 canvas ctx（呼叫前 save、畫完 restore）*/
export function applyGroupTransformToCanvas(
  ctx: CanvasRenderingContext2D,
  t: ArStickerTransform,
  canvasW: number,
  canvasH: number,
): void {
  const p = canvasGroupTransform(t, canvasW, canvasH);
  ctx.translate(p.translateX, p.translateY);
  ctx.scale(p.scale, p.scale);
  ctx.translate(-p.originX, -p.originY);
}
