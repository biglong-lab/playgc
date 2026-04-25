// 🎵 Cloudinary 音訊 URL 處理
//
// 問題：管理員上傳音訊檔到 Cloudinary 通常走 /video/upload/ 路徑
//   → 這會被當成 video resource，原始檔案副檔名可能是 .mp4 / .webm
//   → 直接用 new Audio(url) 在 iOS Safari / Chrome 偶發無法播放
//
// 解決：URL 後綴強制 .mp3，Cloudinary 會自動 transcode
//   https://res.cloudinary.com/.../video/upload/v123/path
//   → https://res.cloudinary.com/.../video/upload/v123/path.mp3

const AUDIO_EXTENSIONS = /\.(mp3|m4a|aac|wav|ogg|flac)(\?|$)/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|avi|mkv)(\?|$)/i;

/**
 * 把任何 Cloudinary URL 轉成保證能播的音訊 URL
 *   - 已是音訊副檔名 → 原樣返回
 *   - Cloudinary /video/upload/ + 影片副檔名 → 替換為 .mp3
 *   - Cloudinary /video/upload/ 無副檔名 → 加 .mp3
 *   - 非 Cloudinary URL → 原樣返回（讓瀏覽器自己處理）
 */
export function ensureAudioUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (typeof url !== "string") return "";

  // 已是音訊格式 → 直接用
  if (AUDIO_EXTENSIONS.test(url)) return url;

  // 不是 Cloudinary → 原樣返回
  if (!url.includes("res.cloudinary.com") && !url.includes("/video/upload/")) {
    return url;
  }

  // Cloudinary 影片 URL → 替換或附加 .mp3
  if (VIDEO_EXTENSIONS.test(url)) {
    return url.replace(VIDEO_EXTENSIONS, ".mp3$2");
  }

  // 沒有副檔名 → 在 query 前附加 .mp3
  const queryIdx = url.indexOf("?");
  if (queryIdx >= 0) {
    return url.slice(0, queryIdx) + ".mp3" + url.slice(queryIdx);
  }
  return url + ".mp3";
}

/**
 * 建立可靠的 Audio 物件 — 含多層 fallback
 *
 * 1. 嘗試 .mp3（Cloudinary transcode）
 * 2. 失敗 → fallback 原始 URL
 * 3. 仍失敗 → console.error + 提供 onError callback
 */
export function createReliableAudio(
  url: string | null | undefined,
  options?: {
    loop?: boolean;
    volume?: number;
    onError?: (err: Event | string) => void;
    onReady?: () => void;
  },
): HTMLAudioElement | null {
  if (!url) return null;

  const audio = new Audio();
  audio.loop = options?.loop ?? true;
  audio.volume = options?.volume ?? 0.3;
  audio.preload = "auto";
  // crossOrigin 讓 Cloudinary 跨域音訊可以正確播放
  audio.crossOrigin = "anonymous";

  const optimizedUrl = ensureAudioUrl(url);
  let triedFallback = false;

  audio.addEventListener("error", () => {
    const e = audio.error;
    console.warn("[audio] load error:", {
      code: e?.code,
      message: e?.message,
      currentSrc: audio.currentSrc,
    });
    // 還沒試過 fallback 就嘗試原始 URL
    if (!triedFallback && optimizedUrl !== url) {
      triedFallback = true;
      console.log("[audio] fallback to original url:", url);
      audio.src = url;
    } else {
      options?.onError?.(audio.error?.message ?? "load error");
    }
  });

  audio.addEventListener("canplay", () => {
    options?.onReady?.();
  });

  audio.src = optimizedUrl;
  return audio;
}
