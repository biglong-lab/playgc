// 🎨 變體訊息抽取器（玩家端用）
//
// 設計：
//   admin 用 DeepSeek 為每個任務預先生成 8-12 個訊息變體存進 pages.variant_pool
//   玩家觸發任務時，從對應類別陣列隨機抽一個（不用每次呼叫 AI）
//
// 用法：
//   const successMsg = pickVariant(page.variantPool, "success", aiResult.feedback);
//   toast({ title: successMsg });
//
// 行為：
//   1. variantPool 不存在 / key 不存在 / 陣列空 → 回 fallback（通常是 AI 即時 feedback）
//   2. 否則從陣列隨機抽一個

export interface VariantPoolShape {
  success?: string[];
  fail?: string[];
  nearMiss?: string[];
  hint?: string[];
  generatedAt?: string;
  model?: string;
}

export type VariantPoolKey = "success" | "fail" | "nearMiss" | "hint";

/**
 * 從變體池隨機抽一個訊息；若 pool 沒對應類別/沒陣列/陣列空，回傳 fallback
 *
 * @param pool 從 page.variantPool 取得（可能 null/undefined）
 * @param key 訊息類別
 * @param fallback 後備訊息（通常是 AI 即時回的 feedback 或硬編碼預設）
 */
export function pickVariant(
  pool: unknown,
  key: VariantPoolKey,
  fallback: string,
): string {
  if (!pool || typeof pool !== "object") return fallback;
  const arr = (pool as VariantPoolShape)[key];
  if (!Array.isArray(arr) || arr.length === 0) return fallback;
  const idx = Math.floor(Math.random() * arr.length);
  const picked = arr[idx];
  if (typeof picked !== "string" || picked.length === 0) return fallback;
  return picked;
}

/**
 * 🆕 P11-8: pickVariant 的詳細版本，回傳 text + index（給 FeedbackButtons 用）
 *
 * 用法：
 *   const result = pickVariantWithIndex(variantPool, "success", aiFeedback);
 *   toast({ title: result.text });
 *   if (result.index >= 0) {
 *     <FeedbackButtons variantIndex={result.index} variantText={result.text} ... />
 *   }
 *
 * @returns { text, index, isFromPool }
 *   - isFromPool=true: 從 pool 抽到，index 為陣列位置（≥ 0）
 *   - isFromPool=false: 用 fallback，index = -1（玩家不該看到反饋按鈕）
 */
export function pickVariantWithIndex(
  pool: unknown,
  key: VariantPoolKey,
  fallback: string,
): { text: string; index: number; isFromPool: boolean } {
  if (!pool || typeof pool !== "object") {
    return { text: fallback, index: -1, isFromPool: false };
  }
  const arr = (pool as VariantPoolShape)[key];
  if (!Array.isArray(arr) || arr.length === 0) {
    return { text: fallback, index: -1, isFromPool: false };
  }
  const idx = Math.floor(Math.random() * arr.length);
  const picked = arr[idx];
  if (typeof picked !== "string" || picked.length === 0) {
    return { text: fallback, index: -1, isFromPool: false };
  }
  return { text: picked, index: idx, isFromPool: true };
}

/**
 * 是否有可用的變體池（用於 admin UI 顯示「✓ 已生成」狀態）
 */
export function hasVariantPool(pool: unknown, key?: VariantPoolKey): boolean {
  if (!pool || typeof pool !== "object") return false;
  const p = pool as VariantPoolShape;
  if (key) {
    return Array.isArray(p[key]) && p[key]!.length > 0;
  }
  // 任一類別有變體即視為有 pool
  return ["success", "fail", "nearMiss", "hint"].some((k) => {
    const v = p[k as VariantPoolKey];
    return Array.isArray(v) && v.length > 0;
  });
}

/**
 * 計算變體池的訊息總數
 */
export function countVariants(pool: unknown): {
  total: number;
  byCategory: Record<VariantPoolKey, number>;
} {
  const result = {
    total: 0,
    byCategory: { success: 0, fail: 0, nearMiss: 0, hint: 0 } as Record<VariantPoolKey, number>,
  };
  if (!pool || typeof pool !== "object") return result;
  const p = pool as VariantPoolShape;
  for (const k of ["success", "fail", "nearMiss", "hint"] as VariantPoolKey[]) {
    const v = p[k];
    if (Array.isArray(v)) {
      result.byCategory[k] = v.length;
      result.total += v.length;
    }
  }
  return result;
}
