// 🎞️ useAnimatedStickers — 錄影用的動態貼圖幀源管理
//
// 背景（CHITO 1bc34792 / 26ecaf3a）：
//   drawImage(HTMLImageElement) 依規範只畫動態圖的第一幀（掛不掛 DOM 都一樣，
//   已實測），所以錄影合成必須另外準備幀源：
//     - 有 ImageDecoder（Chrome/Android）→ 解成 ImageBitmap 幀序列
//     - 沒有（舊版 iOS Safari）→ Cloudinary f_mp4 影片當幀源
//   兩條路都要「先下載整份動畫」，冷啟可能好幾秒 → 期間錄影只會拿到靜態幀。
//   因此本 hook 除了管理幀源，也回報 ready，讓 UI 在載好前擋住錄影。
import { useEffect, useRef, useState } from "react";
import { loadAnimatedSticker, type AnimatedSticker } from "./animatedSticker";

/** 貼圖 URL 看起來是動態格式（決定是否需要等載入） */
function looksAnimatedUrl(url: string | undefined): boolean {
  return /\.(gif|webp)(\?|$)/i.test(url ?? "");
}

export interface AnimatedStickersApi {
  /** 是否有動態貼圖需要等待 */
  hasAnimated: boolean;
  /** 幀源已備妥（沒有動態貼圖時恆為 true） */
  ready: boolean;
  /** 依錄影經過時間取各貼圖當前幀（靜態貼圖為 null → 呼叫端 fallback <img>） */
  framesAt: (elapsedMs: number) => (CanvasImageSource | null)[];
}

export function useAnimatedStickers(
  stickers: { imageUrl: string }[],
): AnimatedStickersApi {
  const stickersRef = useRef<(AnimatedSticker | null)[]>([]);
  const [loaded, setLoaded] = useState(false);
  const hasAnimated = stickers.some((s) => looksAnimatedUrl(s.imageUrl));

  useEffect(() => {
    if (stickers.length === 0) return;
    let cancelled = false;
    Promise.all(stickers.map((s) => loadAnimatedSticker(s.imageUrl))).then((arr) => {
      if (cancelled) {
        arr.forEach((a) => a?.close());
        return;
      }
      stickersRef.current = arr;
      setLoaded(true);
    });
    return () => {
      cancelled = true;
      setLoaded(false);
      stickersRef.current.forEach((a) => a?.close());
      stickersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stickers]);

  return {
    hasAnimated,
    ready: !hasAnimated || loaded,
    framesAt: (elapsedMs: number) =>
      stickersRef.current.map((a) => (a ? a.getFrameAt(elapsedMs) : null)),
  };
}
