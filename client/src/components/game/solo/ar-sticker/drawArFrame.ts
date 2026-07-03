// 🖼️ drawArFrame — 把 video 畫面 + AR 貼圖合成到 canvas
// 拍照（單張）與錄影（每幀）共用同一套合成，確保兩者結果一致。
import type { AnchorCoordinate } from "@/lib/face-landmarker";
import type { ArStickerTransform } from "./useArStickerGesture";
import { applyGroupTransformToCanvas } from "./arStickerTransform";

export type StickerPosition =
  | "top" | "bottom" | "center"
  | "corner_tl" | "corner_tr" | "corner_bl" | "corner_br";

export interface DrawSticker {
  imageUrl: string;
  position: StickerPosition;
  sizeRatio: number;
  opacity?: number;
}

// 固定位置貼圖在 canvas 的 x/y/w/h（與元件內 computeStickerRect 同邏輯）
export function computeStickerRect(
  pos: StickerPosition,
  sizeRatio: number,
  canvasW: number,
  canvasH: number,
  stickerNaturalRatio: number,
): { x: number; y: number; w: number; h: number } {
  const ratio = Math.min(sizeRatio, 1.0);
  const shortSide = Math.min(canvasW, canvasH);
  const w = shortSide * ratio;
  const h = w / stickerNaturalRatio;
  const margin = shortSide * 0.05;
  let x = 0;
  let y = 0;
  switch (pos) {
    case "top":       x = (canvasW - w) / 2; y = margin; break;
    case "bottom":    x = (canvasW - w) / 2; y = canvasH - h - margin; break;
    case "center":    x = (canvasW - w) / 2; y = (canvasH - h) / 2; break;
    case "corner_tl": x = margin; y = margin; break;
    case "corner_tr": x = canvasW - w - margin; y = margin; break;
    case "corner_bl": x = margin; y = canvasH - h - margin; break;
    case "corner_br": x = canvasW - w - margin; y = canvasH - h - margin; break;
  }
  return { x, y, w, h };
}

export interface DrawArFrameOpts {
  stickers: DrawSticker[];
  preloadedStickers: (HTMLImageElement | null)[];
  useFaceTracking: boolean;
  faceAnchor: AnchorCoordinate | null;
  isMirror: boolean;
  pageOpacity: number;
  gestureTransform: ArStickerTransform;
  applyGesture: boolean;
}

/** 將 video 當前畫面 + 貼圖合成到 canvas（會設定 canvas 尺寸為 video 原生尺寸）*/
export function drawArFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  opts: DrawArFrameOpts,
): boolean {
  if (!video.videoWidth || !video.videoHeight) return false;
  if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
  if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  const { stickers, preloadedStickers, useFaceTracking, faceAnchor, isMirror, pageOpacity, gestureTransform, applyGesture } = opts;

  // 底圖：video（前鏡頭鏡像，與預覽一致）
  if (isMirror) {
    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  if (isMirror) ctx.restore();

  const useGesture = !useFaceTracking && applyGesture;
  if (useGesture) {
    ctx.save();
    applyGroupTransformToCanvas(ctx, gestureTransform, canvas.width, canvas.height);
  }

  for (let i = 0; i < stickers.length; i++) {
    const s = stickers[i];
    const img = preloadedStickers[i];
    if (!img) continue;
    // 🐛 2026-07-03 修「成品沒貼圖」：SVG 無 intrinsic size 時 Safari naturalWidth/Height=0
    //   → ratio=NaN → drawImage 尺寸 NaN 靜默不畫（預覽 <img> 用 CSS 定寬所以看得到）。
    //   防護：無效比例 fallback 1（正方形）。
    const ratio =
      img.naturalWidth > 0 && img.naturalHeight > 0
        ? img.naturalWidth / img.naturalHeight
        : 1;
    const opacity = s.opacity ?? pageOpacity;

    if (useFaceTracking) {
      if (!faceAnchor) continue;
      const anchorW = faceAnchor.width * canvas.width * (s.sizeRatio || 0.6);
      const anchorH = anchorW / ratio;
      const cx = (isMirror ? 1 - faceAnchor.x : faceAnchor.x) * canvas.width;
      const cy = faceAnchor.y * canvas.height;
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.translate(cx, cy);
      if (faceAnchor.rotationY) ctx.rotate(faceAnchor.rotationY);
      ctx.drawImage(img, -anchorW / 2, -anchorH / 2, anchorW, anchorH);
      ctx.restore();
    } else {
      const rect = computeStickerRect(s.position, s.sizeRatio, canvas.width, canvas.height, ratio);
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    }
  }

  if (useGesture) ctx.restore();
  return true;
}
