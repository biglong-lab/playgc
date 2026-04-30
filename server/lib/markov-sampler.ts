// 🔄 Markov Sampler — 依訓練後 transition matrix 抽下一個 page type（P16-4）
//
// 用途：
//   給定 (fieldId, currentType)，依「成功玩家在 from 後最常去的 to」機率抽
//   後續用於：
//     - Roguelike composer 排序模組（取代純 shuffle）
//     - Admin Copilot 注入機率參考
//
// 演算法：
//   1. 從 page_type_transitions 取 (fieldId, fromType=currentType) 所有 row
//   2. 計算機率分佈：probability = count / sumCount
//   3. 加權隨機抽（cumulative distribution）
//
// fallback 策略（向後相容）：
//   - 表沒資料 → 回傳 null（caller 走純隨機）
//   - 樣本不足（< minSamples）→ 回傳 null
//   - allowedTypes 過濾後變空集 → 回傳 null
//
// 範圍限制：
//   - 不做溫度（temperature）參數
//   - 不做 K-step 預測
//   - 純 stateless，cache 由本層管

import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  pageTypeTransitions,
  type TransitionProbability,
} from "@shared/schema";

export interface SampleOptions {
  /** 限制只能從此清單內抽（例如 roguelike 池中現有的 pageTypes） */
  allowedTypes?: string[];
  /** 樣本最少門檻（預設 5：累積總次數 < 5 視為樣本不足） */
  minSamples?: number;
}

export interface SampleResult {
  /** 抽中的 toType，若無資料則 null */
  pickedType: string | null;
  /** 用什麼方式抽：'markov' / 'fallback-random' / 'no-data' / 'insufficient' / 'no-allowed' */
  reason: string;
  /** 候選清單與機率（admin 可審視） */
  candidates: TransitionProbability[];
}

// ============================================================================
// In-memory cache（5 分鐘 TTL）
// ============================================================================
interface CacheEntry {
  expiresAt: number;
  rows: TransitionProbability[];
}
const probCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function cacheKey(fieldId: string, fromType: string): string {
  return `${fieldId}|${fromType}`;
}

/**
 * 清除指定場域的快取（訓練後呼叫）
 */
export function invalidateMarkovCache(fieldId?: string): void {
  if (!fieldId) {
    probCache.clear();
    return;
  }
  for (const k of Array.from(probCache.keys())) {
    if (k.startsWith(`${fieldId}|`)) probCache.delete(k);
  }
}

// ============================================================================
// 取機率分佈（內部函式）
// ============================================================================
async function loadTransitionProbabilities(
  fieldId: string,
  fromType: string,
): Promise<TransitionProbability[]> {
  const cKey = cacheKey(fieldId, fromType);
  const cached = probCache.get(cKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.rows;
  }

  const rows = await db
    .select({
      toType: pageTypeTransitions.toType,
      successCount: pageTypeTransitions.successCount,
      totalCount: pageTypeTransitions.totalCount,
    })
    .from(pageTypeTransitions)
    .where(
      and(
        eq(pageTypeTransitions.fieldId, fieldId),
        eq(pageTypeTransitions.fromType, fromType),
      ),
    );

  const sum = rows.reduce((acc, r) => acc + r.totalCount, 0);

  const probs: TransitionProbability[] = rows.map((r) => ({
    fromType,
    toType: r.toType,
    successCount: r.successCount,
    totalCount: r.totalCount,
    probability: sum > 0 ? r.totalCount / sum : 0,
  }));

  probCache.set(cKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    rows: probs,
  });

  return probs;
}

// ============================================================================
// 加權隨機抽（cumulative distribution）
// ============================================================================
function weightedPick(candidates: TransitionProbability[]): string | null {
  if (candidates.length === 0) return null;
  const total = candidates.reduce((acc, c) => acc + c.totalCount, 0);
  if (total === 0) return null;
  const r = Math.random() * total;
  let cumulative = 0;
  for (const c of candidates) {
    cumulative += c.totalCount;
    if (r < cumulative) return c.toType;
  }
  return candidates[candidates.length - 1].toType; // fallback：浮點誤差
}

// ============================================================================
// 主 API：抽下一個 page type
// ============================================================================
export async function sampleNextType(
  fieldId: string,
  currentType: string,
  options: SampleOptions = {},
): Promise<SampleResult> {
  const minSamples = options.minSamples ?? 5;

  const all = await loadTransitionProbabilities(fieldId, currentType);

  if (all.length === 0) {
    return {
      pickedType: null,
      reason: "no-data",
      candidates: [],
    };
  }

  // allowedTypes 過濾
  const filtered = options.allowedTypes
    ? all.filter((c) => options.allowedTypes!.includes(c.toType))
    : all;

  if (filtered.length === 0) {
    return {
      pickedType: null,
      reason: "no-allowed",
      candidates: all,
    };
  }

  const totalCount = filtered.reduce((acc, c) => acc + c.totalCount, 0);
  if (totalCount < minSamples) {
    return {
      pickedType: null,
      reason: "insufficient",
      candidates: filtered,
    };
  }

  const picked = weightedPick(filtered);
  return {
    pickedType: picked,
    reason: "markov",
    candidates: filtered,
  };
}

/**
 * 取機率分佈（給 admin / composer 參考用，不做抽樣）
 */
export async function getTransitionProbabilities(
  fieldId: string,
  fromType: string,
): Promise<TransitionProbability[]> {
  return loadTransitionProbabilities(fieldId, fromType);
}
