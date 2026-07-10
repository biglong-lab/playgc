// 📦 圖片上傳前本地壓縮共用工具
//
// 背景：管理端上傳原本 FileReader 直送 base64（單張可達 5–15MB），
// 走 server 中轉最耗頻寬也最慢。上傳前在瀏覽器壓縮可省流量、
// 加快上傳、並降低 Cloudinary transformation 額度消耗。
//
// 邊界：
// - GIF（動圖會失幀）與 SVG（向量）不壓縮、原樣回傳
// - PNG 保持 PNG 輸出（透明度不會變黑底）、僅縮邊
// - 壓縮失敗 fallback 原檔（server 端仍有大小上限擋著）

import imageCompression from "browser-image-compression";

export type CompressPreset = "photo" | "cover" | "logo";

const PRESETS: Record<
  CompressPreset,
  { maxWidthOrHeight: number; maxSizeMB: number; initialQuality: number }
> = {
  /** 玩家照 / 一般照片素材 */
  photo: { maxWidthOrHeight: 1920, maxSizeMB: 1.5, initialQuality: 0.82 },
  /** 封面 / 大圖素材（場域封面 1920x1080、活動 1600x900 都涵蓋） */
  cover: { maxWidthOrHeight: 2048, maxSizeMB: 2, initialQuality: 0.85 },
  /** Logo / 徽章 / 品項小圖 */
  logo: { maxWidthOrHeight: 1024, maxSizeMB: 0.5, initialQuality: 0.9 },
};

/** 不壓縮的格式：動圖失幀 / 向量無意義 */
const SKIP_TYPES = ["image/gif", "image/svg+xml"];

function fileToDataUrl(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 壓縮圖片檔並回傳 base64 data URL（供既有 `{ imageData }` JSON 端點直用）
 *
 * @param file   使用者選的圖片檔
 * @param preset 壓縮等級（photo / cover / logo）
 * @returns base64 data URL；非圖片或壓縮失敗時回原檔 data URL
 */
export async function compressImageToDataUrl(
  file: File,
  preset: CompressPreset,
): Promise<string> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.includes(file.type)) {
    return fileToDataUrl(file);
  }
  try {
    const opts = PRESETS[preset];
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: opts.maxWidthOrHeight,
      maxSizeMB: opts.maxSizeMB,
      initialQuality: opts.initialQuality,
      useWebWorker: true,
      // 不指定 fileType → 保持原格式（PNG 透明度不會變黑底）
    });
    // 壓完反而變大（已高度優化的小圖）就用原檔
    const chosen = compressed.size < file.size ? compressed : file;
    return fileToDataUrl(chosen);
  } catch {
    // Web Worker / canvas 在少數 in-app 瀏覽器可能失敗 → 原檔照傳
    return fileToDataUrl(file);
  }
}
