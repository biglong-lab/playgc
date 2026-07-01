// AR 貼圖共用零件：型別、固定位置樣式、預載、臉部貼圖 overlay
// （從 PhotoArStickerFlow 抽出以控制主檔行數）
import { memo } from "react";
import type { AnchorCoordinate } from "@/lib/face-landmarker";
import type { StickerPosition } from "./drawArFrame";

export type { StickerPosition } from "./drawArFrame";

export interface StickerConfigItem {
  imageUrl: string;
  position: StickerPosition;
  sizeRatio: number; // 0-1，佔畫面短邊比例
  opacity?: number;
}

// 位置 → CSS style 對照（配合 absolute overlay）
export function positionToStyle(pos: StickerPosition, sizeRatio: number): React.CSSProperties {
  const sizePct = `${Math.min(sizeRatio, 1.0) * 100}%`;
  const commonStyle: React.CSSProperties = {
    position: "absolute",
    width: sizePct,
    pointerEvents: "none",
  };
  switch (pos) {
    case "top":       return { ...commonStyle, top: "5%", left: "50%", transform: "translateX(-50%)" };
    case "bottom":    return { ...commonStyle, bottom: "5%", left: "50%", transform: "translateX(-50%)" };
    case "center":    return { ...commonStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    case "corner_tl": return { ...commonStyle, top: "5%", left: "5%" };
    case "corner_tr": return { ...commonStyle, top: "5%", right: "5%" };
    case "corner_bl": return { ...commonStyle, bottom: "5%", left: "5%" };
    case "corner_br": return { ...commonStyle, bottom: "5%", right: "5%" };
  }
}

// 🎨 預載貼圖（單張失敗不影響其他，回傳 array，失敗位置為 null）；加 timeout 避免壞 URL 卡住
export async function preloadStickers(
  items: StickerConfigItem[],
): Promise<(HTMLImageElement | null)[]> {
  const results = await Promise.allSettled(
    items.map(
      (s) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          const timer = setTimeout(() => reject(new Error("timeout")), 10000);
          img.onload = () => {
            clearTimeout(timer);
            resolve(img);
          };
          img.onerror = () => {
            clearTimeout(timer);
            reject(new Error(`載入失敗: ${s.imageUrl}`));
          };
          img.src = s.imageUrl;
        }),
    ),
  );
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}

// 🎯 臉部貼圖 overlay — 獨立 memo，避免高頻 setFaceAnchor 連帶 re-render 整個 flow
interface FaceStickersOverlayProps {
  stickers: StickerConfigItem[];
  preloadedStickers: (HTMLImageElement | null)[];
  preloadDone: boolean;
  faceAnchor: AnchorCoordinate | null;
  isMirror: boolean;
  pageOpacity?: number;
}

export const FaceStickersOverlay = memo(function FaceStickersOverlay({
  stickers,
  preloadedStickers,
  preloadDone,
  faceAnchor,
  isMirror,
  pageOpacity = 1,
}: FaceStickersOverlayProps) {
  if (!faceAnchor) return null;

  return (
    <>
      {stickers.map((s, idx) => {
        const img = preloadedStickers[idx];
        if (preloadDone && !img) return null;
        const imgRatio = img ? img.naturalWidth / img.naturalHeight : 1;
        const widthPct = faceAnchor.width * 100 * (s.sizeRatio || 0.6);
        const heightPct = widthPct / imgRatio;
        const rotation = faceAnchor.rotationY
          ? `rotate(${(faceAnchor.rotationY * 180) / Math.PI}deg)`
          : "";
        const visualX = isMirror ? 1 - faceAnchor.x : faceAnchor.x;
        const mirror = isMirror ? " scaleX(-1)" : "";
        const opacity = s.opacity ?? pageOpacity;
        return (
          <img
            key={idx}
            src={s.imageUrl}
            alt=""
            style={{
              position: "absolute",
              left: `${visualX * 100}%`,
              top: `${faceAnchor.y * 100}%`,
              width: `${widthPct}%`,
              height: `${heightPct}%`,
              transform: `translate(-50%, -50%) ${rotation}${mirror}`,
              opacity,
              pointerEvents: "none",
              transition: "top 0.08s, left 0.08s",
            }}
            data-testid={`ar-sticker-face-${idx}`}
          />
        );
      })}
    </>
  );
});
