// 🎞️ animatedSticker — 動態 WebP/GIF 貼圖解幀（給錄影合成用）
//
// 背景（CHITO #1bc34792 2026-07-08）：
//   canvas drawImage(HTMLImageElement) 依 HTML 規範只會畫動態圖的「第一幀」
//   → 預覽 <img> 會動（瀏覽器自動播）、錄影成品貼圖卻靜止。
//   修法：用 WebCodecs ImageDecoder 把動態 WebP/GIF 解成 ImageBitmap 幀序列，
//   錄影 loop 依經過時間取對應幀畫進 canvas。
//
// 支援度：Chrome/Edge/Android WebView 94+；iOS Safari 尚未支援 ImageDecoder
//   → 不支援時回 null、錄影維持既有行為（靜態第一幀），不影響拍照與其他功能。

interface DecodedFrame {
  bitmap: ImageBitmap;
  /** 此幀顯示時長（ms） */
  durationMs: number;
  /** 幀起始時間（累計，ms） */
  startMs: number;
}

export interface AnimatedSticker {
  frames: DecodedFrame[];
  totalMs: number;
  width: number;
  height: number;
  /** 依錄影經過時間取當前幀（自動 loop） */
  getFrameAt: (elapsedMs: number) => ImageBitmap;
  /** 釋放所有 ImageBitmap */
  close: () => void;
}

// WebCodecs ImageDecoder 最小型別（TS DOM lib 可能未內建）
interface ImageDecoderFrame {
  image: {
    duration: number | null; // microseconds
    displayWidth: number;
    displayHeight: number;
    close: () => void;
  } & ImageBitmapSource;
}
interface ImageDecoderLike {
  tracks: {
    ready: Promise<void>;
    selectedTrack: { frameCount: number; animated: boolean } | null;
  };
  decode: (opts: { frameIndex: number }) => Promise<ImageDecoderFrame>;
  close: () => void;
}
interface ImageDecoderCtor {
  new (init: { data: ArrayBuffer; type: string }): ImageDecoderLike;
  isTypeSupported?: (type: string) => Promise<boolean>;
}

const DEFAULT_FRAME_MS = 100; // 無 duration 資訊時的每幀時長
const MAX_FRAMES = 300;       // 防超長動畫吃爆記憶體（300 幀 ≈ 30s@10fps）

/** 是否可能是動態格式（先以副檔名/URL 粗篩、再以 content-type 確認） */
function looksAnimatedType(mime: string): boolean {
  return mime === "image/webp" || mime === "image/gif" || mime === "image/apng" || mime === "image/png";
}

/**
 * 載入動態貼圖 → 解出幀序列
 * @returns AnimatedSticker；靜態圖 / 不支援 ImageDecoder / 失敗 → null（呼叫端 fallback 靜態）
 */
export async function loadAnimatedSticker(url: string): Promise<AnimatedSticker | null> {
  const ImageDecoderClass = (globalThis as { ImageDecoder?: ImageDecoderCtor }).ImageDecoder;
  if (!ImageDecoderClass) return null;

  let decoder: ImageDecoderLike | null = null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!looksAnimatedType(mime)) return null;
    if (ImageDecoderClass.isTypeSupported && !(await ImageDecoderClass.isTypeSupported(mime))) {
      return null;
    }
    const data = await res.arrayBuffer();

    decoder = new ImageDecoderClass({ data, type: mime });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    // 靜態圖（單幀）→ 不需要動畫處理
    if (!track || !track.animated || track.frameCount <= 1) {
      decoder.close();
      return null;
    }

    const frameCount = Math.min(track.frameCount, MAX_FRAMES);
    const frames: DecodedFrame[] = [];
    let acc = 0;
    for (let i = 0; i < frameCount; i++) {
      const { image } = await decoder.decode({ frameIndex: i });
      // duration 是微秒；null/0 → 給預設
      const durationMs = image.duration ? image.duration / 1000 : DEFAULT_FRAME_MS;
      const bitmap = await createImageBitmap(image as ImageBitmapSource);
      image.close();
      frames.push({ bitmap, durationMs, startMs: acc });
      acc += durationMs;
    }
    decoder.close();
    decoder = null;

    if (frames.length <= 1) {
      frames.forEach((f) => f.bitmap.close());
      return null;
    }

    const totalMs = acc;
    return {
      frames,
      totalMs,
      width: frames[0].bitmap.width,
      height: frames[0].bitmap.height,
      getFrameAt: (elapsedMs: number) => {
        const t = ((elapsedMs % totalMs) + totalMs) % totalMs;
        // 線性掃描即可（幀數有限、每 rAF 一次可接受）
        for (let i = frames.length - 1; i >= 0; i--) {
          if (t >= frames[i].startMs) return frames[i].bitmap;
        }
        return frames[0].bitmap;
      },
      close: () => {
        frames.forEach((f) => {
          try { f.bitmap.close(); } catch { /* ignore */ }
        });
      },
    };
  } catch {
    try { decoder?.close(); } catch { /* ignore */ }
    return null;
  }
}
