/** Cloudinary URL 變換選項 */
interface CloudinaryTransformOptions {
  readonly width?: number;
  readonly height?: number;
  readonly quality?: "auto" | number;
  readonly format?: "auto" | "webp" | "avif";
  readonly crop?: "fill" | "fit" | "limit" | "thumb";
}

/** 預設變換設定 */
const PRESETS = {
  card: { width: 400, height: 250, quality: "auto" as const, format: "auto" as const, crop: "fill" as const },
  cover: { width: 800, height: 400, quality: "auto" as const, format: "auto" as const, crop: "fill" as const },
  icon: { width: 80, height: 80, quality: "auto" as const, format: "auto" as const, crop: "fill" as const },
  thumbnail: { width: 200, height: 200, quality: "auto" as const, format: "auto" as const, crop: "fill" as const },
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

  return parts.join(",");
}

/** 在 Cloudinary URL 的 /upload/ 後插入變換參數 */
export function addCloudinaryTransform(
  url: string,
  options: CloudinaryTransformOptions,
): string {
  const transformStr = buildTransformString(options);
  if (!transformStr) return url;

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
