/** Cloudinary URL 變換選項 */
interface CloudinaryTransformOptions {
  readonly width?: number;
  readonly height?: number;
  readonly quality?: "auto" | "auto:good" | "auto:best" | "auto:eco" | "auto:low" | number;
  readonly format?: "auto" | "webp" | "avif";
  readonly crop?: "fill" | "fit" | "limit" | "thumb" | "scale";
  readonly dpr?: "auto" | number;
  readonly gravity?: "auto" | "face" | "faces" | "center";
}

/**
 * 預設變換設定
 *
 * 🎯 設計原則：
 *   - 基準尺寸 = 桌面 1x 顯示寬度（給沒送 DPR client hint 的瀏覽器看也夠清楚）
 *   - 配合 srcSet 多解析度 → 高 DPR 螢幕（Retina / 行動裝置）自動拿更大版本
 *   - 用 q_auto:good（比 q_auto 預設略高品質，視覺差異明顯）
 *   - 用 f_auto 自動選 webp / avif（壓縮率高、品質好）
 *   - 用 dpr_auto 配合 client hints（瀏覽器送 DPR header 時 Cloudinary 自動 scale）
 *
 * 📏 尺寸設計（基準寬 = 桌面 1x 顯示寬度）：
 *   card     800×500   (場域卡片、遊戲卡片：桌面 600-800px wide)
 *   cover    1600×800  (Hero 大圖、橫幅：桌面 1200-1600px wide)
 *   icon     160×160   (頭像、icon：原 80px × 2x retina)
 *   thumbnail 400×400  (列表縮圖、避免過小)
 */
const PRESETS = {
  card: {
    width: 800,
    height: 500,
    quality: "auto:good" as const,
    format: "auto" as const,
    crop: "fill" as const,
    dpr: "auto" as const,
    gravity: "auto" as const,
  },
  cover: {
    width: 1600,
    height: 800,
    quality: "auto:good" as const,
    format: "auto" as const,
    crop: "fill" as const,
    dpr: "auto" as const,
    gravity: "auto" as const,
  },
  icon: {
    width: 160,
    height: 160,
    quality: "auto:good" as const,
    format: "auto" as const,
    crop: "fill" as const,
    dpr: "auto" as const,
    gravity: "face" as const,
  },
  thumbnail: {
    width: 400,
    height: 400,
    quality: "auto:good" as const,
    format: "auto" as const,
    crop: "fill" as const,
    dpr: "auto" as const,
    gravity: "auto" as const,
  },
} as const;

export type ImagePreset = keyof typeof PRESETS;

/** 判斷 URL 是否為 Cloudinary URL */
export function isCloudinaryUrl(url: string): boolean {
  return url.includes("res.cloudinary.com") && url.includes("/upload/");
}

/** 組合 Cloudinary 變換參數字串 */
function buildTransformString(options: CloudinaryTransformOptions): string {
  const parts: string[] = [];

  if (options.width) parts.push(`w_${options.width}`);
  if (options.height) parts.push(`h_${options.height}`);
  if (options.quality) parts.push(`q_${options.quality}`);
  if (options.format) parts.push(`f_${options.format}`);
  if (options.crop) parts.push(`c_${options.crop}`);
  if (options.dpr) parts.push(`dpr_${options.dpr}`);
  if (options.gravity) parts.push(`g_${options.gravity}`);

  return parts.join(",");
}

/** 偵測 Cloudinary URL 是否已含 transformation（形如 /upload/w_800,h_600/...） */
function hasExistingTransform(url: string): boolean {
  // /upload/ 緊跟著的 segment 若含 transformation 字母前綴（w_/h_/c_/q_/f_/g_/l_/e_）即視為已有
  const match = url.match(/\/upload\/([^/]+)\//);
  if (!match) return false;
  const segment = match[1];
  // version segment 格式是 v123456789，不是 transformation
  if (/^v\d+$/.test(segment)) return false;
  return /(^|,)(w_|h_|c_|q_|f_|g_|l_|e_|dpr_|ar_|r_|o_|b_)/i.test(segment);
}

/** 在 Cloudinary URL 的 /upload/ 後插入變換參數（已有 transformation 則跳過避免疊加） */
export function addCloudinaryTransform(
  url: string,
  options: CloudinaryTransformOptions,
): string {
  const transformStr = buildTransformString(options);
  if (!transformStr) return url;

  // 若原 URL 已有 transformation segment，不再疊加（避免雙層變換 400 破圖）
  if (hasExistingTransform(url)) return url;

  // 在 /upload/ 後面插入變換參數
  const uploadIndex = url.indexOf("/upload/");
  if (uploadIndex === -1) return url;

  const insertPos = uploadIndex + "/upload/".length;
  return `${url.slice(0, insertPos)}${transformStr}/${url.slice(insertPos)}`;
}

/** 取得優化後的圖片 URL（非 Cloudinary 則原樣返回） */
export function getOptimizedImageUrl(
  url: string | null | undefined,
  preset: ImagePreset | CloudinaryTransformOptions,
): string {
  if (!url) return "";
  if (!isCloudinaryUrl(url)) return url;

  const options = typeof preset === "string" ? PRESETS[preset] : preset;
  return addCloudinaryTransform(url, options);
}

/**
 * 🆕 建立 srcSet 多解析度字串（給 <img srcSet> 用）
 *
 * 為什麼需要：
 *   - 雖然 dpr_auto 配合 client hint 可自動 scale，但**很多瀏覽器不送 DPR header**
 *   - srcSet 是 W3C 標準，所有瀏覽器都支援
 *   - 給 2x / 3x 螢幕拿到對應的高解析度版本
 *
 * 用法：
 *   const srcSet = buildSrcSet(url, "card");
 *   // → "https://...w_400/... 400w, https://...w_800/... 800w, https://...w_1600/... 1600w"
 *   <img src={...} srcSet={srcSet} sizes="(max-width: 768px) 100vw, 800px" />
 *
 * @param url Cloudinary URL（非 Cloudinary 回傳空字串）
 * @param preset 預設或自訂變換
 * @returns srcSet 字串，多個寬度版本
 */
export function buildSrcSet(
  url: string | null | undefined,
  preset: ImagePreset | CloudinaryTransformOptions,
): string {
  if (!url || !isCloudinaryUrl(url)) return "";

  const baseOptions = typeof preset === "string" ? PRESETS[preset] : preset;
  const baseWidth = baseOptions.width ?? 800;
  const aspectRatio = baseOptions.height
    ? baseOptions.height / baseWidth
    : null;

  // 給 1x / 1.5x / 2x / 3x 螢幕的尺寸
  // 但限制最大 2400px（避免超大圖浪費頻寬）
  const widths = [
    Math.round(baseWidth * 0.5),  // mobile / 低 DPR
    baseWidth,                    // 桌面 1x
    Math.round(baseWidth * 1.5),  // 桌面 1.5x
    Math.min(Math.round(baseWidth * 2), 2400),  // 桌面 2x retina
  ].filter((w, i, arr) => arr.indexOf(w) === i); // 去重

  const parts = widths.map((w) => {
    const opts: CloudinaryTransformOptions = {
      ...baseOptions,
      width: w,
      height: aspectRatio ? Math.round(w * aspectRatio) : undefined,
      // srcSet 已經有 width 描述符，不需 dpr_auto（避免重複放大）
      dpr: undefined,
    };
    const u = addCloudinaryTransform(url, opts);
    return `${u} ${w}w`;
  });

  return parts.join(", ");
}

/**
 * 🆕 推薦的 sizes attribute（給 <img sizes> 用）
 *
 * 配合 srcSet 使用，告訴瀏覽器「此圖在不同螢幕寬度時佔多少」
 * 瀏覽器才能從 srcSet 選最適合的版本
 */
export const SIZES_PRESETS = {
  /** 卡片（桌面 1/2 寬，行動 100%）*/
  card: "(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 600px",
  /** Hero 大圖（永遠佔滿寬度）*/
  cover: "100vw",
  /** Icon 固定尺寸 */
  icon: "80px",
  /** Thumbnail 列表 */
  thumbnail: "(max-width: 640px) 50vw, 200px",
} as const;
