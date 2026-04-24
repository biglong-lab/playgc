// 🎨 Photo Composer — Cloudinary Transformation URL 紀念照合成服務
//
// 核心功能：
//   1. 接受玩家照片 publicId + 合成模板設定 + 動態變數（遊戲名 / 分數 / 日期）
//   2. 組出 Cloudinary Transformation URL（layer 疊加 + text overlay + canvas 裁切）
//   3. URL 即時生成，無需等待 webhook（CDN cache 後 <100ms）
//
// 參考：https://cloudinary.com/documentation/transformation_reference

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || '';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type LayerGravity =
  | 'north' | 'south' | 'east' | 'west' | 'center'
  | 'north_east' | 'north_west' | 'south_east' | 'south_west';

export interface ImageLayer {
  type: 'image';
  publicId: string;              // Cloudinary public_id（含資料夾，如 "chito_frames/jiachun_v1"）
  gravity?: LayerGravity;        // 錨點，預設 center
  x?: number;                    // 偏移 X
  y?: number;                    // 偏移 Y
  width?: number;                // 指定寬度（px 或百分比 0-1）
  height?: number;
  opacity?: number;              // 0-100
}

export interface TextLayer {
  type: 'text';
  text: string;                  // 支援 {變數} 插值（如 "{gameTitle}"）
  font?: string;                 // 預設 Noto_Sans_TC_Bold
  size?: number;                 // 字體大小 px，預設 60
  weight?: 'normal' | 'bold';
  color?: string;                // 預設 white
  gravity?: LayerGravity;
  x?: number;
  y?: number;
  /** 背景顏色（加字幕底色）*/
  background?: string;
}

export type CompositionLayer = ImageLayer | TextLayer;

export interface CompositionConfig {
  /** 畫布裁切設定 */
  canvas: {
    width: number;
    height: number;
    crop?: 'fill' | 'fit' | 'limit' | 'scale' | 'pad';
    gravity?: 'auto' | 'face' | 'center';
  };
  /** 由下到上依序疊加的圖層 */
  layers: CompositionLayer[];
}

export interface DynamicVars {
  gameTitle?: string;
  fieldName?: string;
  playerName?: string;
  date?: string;
  duration?: string;
  score?: number;
  rank?: number;
  [key: string]: string | number | undefined;
}

export interface CompositionInput {
  /**
   * 底圖來源 — 二選一：
   *   - playerPhotoPublicId：Cloudinary 上已存在的圖（走 `image/upload`）
   *   - playerPhotoUrl：遠端任意 URL（走 `image/fetch` 由 Cloudinary 代抓）
   * 若都給，優先用 publicId
   */
  playerPhotoPublicId?: string;
  playerPhotoUrl?: string;
  config: CompositionConfig;
  dynamicVars?: DynamicVars;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/**
 * 變數插值：將 "{gameTitle}" 替換成實際值
 */
function interpolate(template: string, vars: DynamicVars): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/**
 * Cloudinary URL 需要對 text / publicId 做特殊編碼
 * - text 內的 `,` `/` `?` `#` 需 URL-encode
 * - publicId 的 `/` 要轉成 `:`（例：`chito_frames/jiachun_v1` → `chito_frames:jiachun_v1`）
 */
function encodeTextForUrl(text: string): string {
  return encodeURIComponent(text)
    .replace(/%20/g, '%20')  // 保持空格 encoded
    .replace(/'/g, '%27');
}

function encodePublicIdForLayer(publicId: string): string {
  return publicId.replace(/\//g, ':');
}

/**
 * 組單一 layer 的 transformation 字串
 */
function buildLayerString(layer: CompositionLayer, vars: DynamicVars): string[] {
  if (layer.type === 'image') {
    const parts: string[] = [];
    parts.push(`l_${encodePublicIdForLayer(layer.publicId)}`);

    const applyParts: string[] = ['fl_layer_apply'];
    if (layer.gravity) applyParts.push(`g_${layer.gravity}`);
    if (layer.x !== undefined) applyParts.push(`x_${layer.x}`);
    if (layer.y !== undefined) applyParts.push(`y_${layer.y}`);
    if (layer.width !== undefined) applyParts.push(`w_${layer.width}`);
    if (layer.height !== undefined) applyParts.push(`h_${layer.height}`);
    if (layer.opacity !== undefined) applyParts.push(`o_${layer.opacity}`);
    parts.push(applyParts.join(','));

    return parts;
  }

  // text layer
  const text = interpolate(layer.text, vars);
  if (!text) return []; // 空字串不輸出

  const font = layer.font || 'Noto_Sans_TC';
  const size = layer.size || 60;
  const weight = layer.weight === 'bold' ? '_bold' : '';
  const encodedText = encodeTextForUrl(text);

  const layerParts = [`l_text:${font}_${size}${weight}:${encodedText}`];
  const styleParts: string[] = [];
  if (layer.color) styleParts.push(`co_${layer.color}`);
  if (layer.background) styleParts.push(`b_${layer.background}`);
  if (layer.gravity) styleParts.push(`g_${layer.gravity}`);
  if (layer.x !== undefined) styleParts.push(`x_${layer.x}`);
  if (layer.y !== undefined) styleParts.push(`y_${layer.y}`);
  if (styleParts.length > 0) {
    layerParts.push(styleParts.join(','));
  }

  return layerParts;
}

// ═══════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════

/**
 * 建構 Cloudinary 合成 URL
 *
 * 範例輸出：
 *   https://res.cloudinary.com/{cloud}/image/upload/
 *     c_fill,w_1080,h_1080/
 *     l_chito_frames:jiachun_v1/fl_layer_apply,g_south,y_0/
 *     l_text:Noto_Sans_TC_60_bold:%E8%B3%88%E6%9D%91/co_white,g_north,y_50/
 *     {playerPhotoPublicId}.jpg
 */
export function buildCompositeUrl(input: CompositionInput): string {
  if (!CLOUD_NAME) {
    throw new Error('CLOUDINARY_CLOUD_NAME not configured');
  }

  const { playerPhotoPublicId, config, dynamicVars = {} } = input;
  const parts: string[] = [];

  // Canvas 裁切
  const { width, height, crop = 'fill', gravity } = config.canvas;
  const canvasParts: string[] = [`c_${crop}`, `w_${width}`, `h_${height}`];
  if (gravity) canvasParts.push(`g_${gravity}`);
  parts.push(canvasParts.join(','));

  // 依序加各 layer（由下到上疊）
  for (const layer of config.layers) {
    const layerStrs = buildLayerString(layer, dynamicVars);
    parts.push(...layerStrs);
  }

  const transformStr = parts.join('/');
  // 結尾 publicId 不轉義斜線（這是底圖路徑）
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${transformStr}/${playerPhotoPublicId}.jpg`;
}

/**
 * 估算 URL 長度（Cloudinary 限制約 1500 字元）
 */
export function estimateUrlLength(input: CompositionInput): number {
  try {
    return buildCompositeUrl(input).length;
  } catch {
    return 0;
  }
}

/**
 * 驗證 composition config 是否合法
 * 返回 [是否合法, 錯誤訊息陣列]
 */
export function validateCompositionConfig(
  config: CompositionConfig,
): [boolean, string[]] {
  const errors: string[] = [];

  if (!config.canvas) {
    errors.push('canvas 欄位必填');
  } else {
    if (!config.canvas.width || config.canvas.width < 1) errors.push('canvas.width 必須 >= 1');
    if (!config.canvas.height || config.canvas.height < 1) errors.push('canvas.height 必須 >= 1');
    if (config.canvas.width > 4000) errors.push('canvas.width 超過 4000');
    if (config.canvas.height > 4000) errors.push('canvas.height 超過 4000');
  }

  if (!Array.isArray(config.layers)) {
    errors.push('layers 必須為陣列');
  } else if (config.layers.length > 10) {
    errors.push('layers 超過 10 個（URL 會過長）');
  } else {
    config.layers.forEach((layer, idx) => {
      if (layer.type === 'image') {
        if (!layer.publicId) errors.push(`layers[${idx}] image 缺 publicId`);
      } else if (layer.type === 'text') {
        if (!layer.text) errors.push(`layers[${idx}] text 缺 text 欄位`);
      } else {
        errors.push(`layers[${idx}] type 不支援`);
      }
    });
  }

  return [errors.length === 0, errors];
}

// ═══════════════════════════════════════════════════════════════
// 預設模板（系統內建，管理員未設定時 fallback）
// ═══════════════════════════════════════════════════════════════

/**
 * 預設紀念照模板（1080×1080，無實際 overlay，只加文字）
 * 當場域/遊戲/頁面都沒設模板時使用
 */
export const DEFAULT_COMPOSITION_CONFIG: CompositionConfig = {
  canvas: {
    width: 1080,
    height: 1080,
    crop: 'fill',
    gravity: 'auto',
  },
  layers: [
    {
      type: 'text',
      text: '{fieldName}',
      font: 'Noto_Sans_TC',
      size: 48,
      weight: 'bold',
      color: 'white',
      background: 'rgb:00000080',  // 黑底半透明
      gravity: 'north',
      y: 40,
    },
    {
      type: 'text',
      text: '{gameTitle}',
      font: 'Noto_Sans_TC',
      size: 36,
      color: 'white',
      gravity: 'south',
      y: 80,
    },
    {
      type: 'text',
      text: '{date}',
      font: 'Noto_Sans_TC',
      size: 28,
      color: 'white',
      gravity: 'south',
      y: 40,
    },
  ],
};

/**
 * 取得今日日期字串（YYYY.MM.DD）供合成圖顯示
 */
export function todayDateString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}
