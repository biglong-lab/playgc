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

// ============================================================================
// 🆕 P12-3: Bandit 加權變體抽取（前端簡化版）
// ============================================================================

/** 變體分數（從 server /api/player/variant-scores 取得） */
export interface VariantScoreShape {
  totalFeedback?: number;
  score?: number; // Wilson Lower Bound [0, 1]
  hidden?: boolean;
}

/**
 * 加權變體抽取（前端版簡化 bandit）
 *
 * 演算法：
 *   1. 過濾 hidden（連續 dislike 自動隱藏的不選）
 *   2. 冷啟動：未達 3 次曝光的優先曝光
 *   3. 加權隨機：權重 = max(score, 0.05)（0.05 floor 防止完全 0）
 *
 * fallback 規則：
 *   - scores 為 null/empty → 退化為純隨機（pickVariantWithIndex 行為）
 *   - 全 hidden → 取第一個（保證不返回空）
 *
 * @returns { text, index, isFromPool, reason }
 *   - reason: 'random' / 'cold-start' / 'weighted' / 'fallback'
 */
export function pickVariantWeighted(
  pool: unknown,
  key: VariantPoolKey,
  fallback: string,
  scores: Record<string, VariantScoreShape> | null | undefined,
): {
  text: string;
  index: number;
  isFromPool: boolean;
  reason: "random" | "cold-start" | "weighted" | "fallback";
} {
  // pool 不存在 → fallback
  if (!pool || typeof pool !== "object") {
    return { text: fallback, index: -1, isFromPool: false, reason: "fallback" };
  }
  const arr = (pool as VariantPoolShape)[key];
  if (!Array.isArray(arr) || arr.length === 0) {
    return { text: fallback, index: -1, isFromPool: false, reason: "fallback" };
  }

  // 沒 scores → 純隨機
  if (!scores || Object.keys(scores).length === 0) {
    const idx = Math.floor(Math.random() * arr.length);
    const picked = arr[idx];
    if (typeof picked !== "string" || picked.length === 0) {
      return { text: fallback, index: -1, isFromPool: false, reason: "fallback" };
    }
    return { text: picked, index: idx, isFromPool: true, reason: "random" };
  }

  // 有 scores：建立候選清單（過濾 hidden）
  type Candidate = {
    index: number;
    text: string;
    pulls: number;
    reward: number;
  };
  const candidates: Candidate[] = [];
  for (let i = 0; i < arr.length; i++) {
    const text = arr[i];
    if (typeof text !== "string" || text.length === 0) continue;
    const sc = scores[`${key}|${i}`];
    if (sc?.hidden) continue;
    candidates.push({
      index: i,
      text,
      pulls: sc?.totalFeedback ?? 0,
      reward: sc?.score ?? 0.5, // 沒分 = 中性 0.5
    });
  }

  // 全 hidden → 取第一個
  if (candidates.length === 0) {
    const text = arr[0];
    if (typeof text !== "string" || text.length === 0) {
      return { text: fallback, index: -1, isFromPool: false, reason: "fallback" };
    }
    return { text, index: 0, isFromPool: true, reason: "fallback" };
  }

  // 冷啟動：未達 3 次曝光的優先
  const cold = candidates.filter((c) => c.pulls < 3);
  if (cold.length > 0) {
    const picked = cold[Math.floor(Math.random() * cold.length)];
    return {
      text: picked.text,
      index: picked.index,
      isFromPool: true,
      reason: "cold-start",
    };
  }

  // 過冷啟動 → 加權隨機（reward 越高越常被選）
  // 權重 = max(reward, 0.05)（floor 防完全 0）
  const weights = candidates.map((c) => Math.max(c.reward, 0.05));
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * totalWeight;
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      return {
        text: candidates[i].text,
        index: candidates[i].index,
        isFromPool: true,
        reason: "weighted",
      };
    }
  }
  // 浮點誤差 fallback
  const last = candidates[candidates.length - 1];
  return {
    text: last.text,
    index: last.index,
    isFromPool: true,
    reason: "weighted",
  };
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
