// 💳 場域方案（P2 底座，2026-09-23）
//
// 用途：執行時判斷「這個場域的方案有沒有這個功能」。
// 快取 60 秒（方案很少變；每次 API 請求都查會多一次 join）。
// 讀不到方案（沒訂閱紀錄 / DB 失敗）→ 回 null features = 一律放行。
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fieldSubscriptions, platformPlans } from "@shared/schema";
import { planHasFeature } from "@shared/lib/plan-features";

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

export interface FieldPlan {
  planCode: string | null;
  status: string | null;
  features: string[] | null;
}

const cache = new Map<string, { value: FieldPlan; expiresAt: number }>();

export function invalidateFieldPlan(fieldId: string): void {
  cache.delete(fieldId);
}

function prune(now: number): void {
  if (cache.size < MAX_ENTRIES) return;
  cache.forEach((entry, key) => {
    if (entry.expiresAt <= now) cache.delete(key);
  });
  if (cache.size < MAX_ENTRIES) return;
  Array.from(cache.entries())
    .sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    .slice(0, Math.ceil(cache.size / 2))
    .forEach(([key]) => cache.delete(key));
}

export async function loadFieldPlan(fieldId: string): Promise<FieldPlan> {
  const now = Date.now();
  const hit = cache.get(fieldId);
  if (hit && hit.expiresAt > now) return hit.value;
  try {
    const [row] = await db
      .select({
        status: fieldSubscriptions.status,
        planCode: platformPlans.code,
        features: platformPlans.features,
      })
      .from(fieldSubscriptions)
      .innerJoin(platformPlans, eq(platformPlans.id, fieldSubscriptions.planId))
      .where(eq(fieldSubscriptions.fieldId, fieldId))
      .limit(1);
    const value: FieldPlan = row
      ? { planCode: row.planCode, status: row.status, features: row.features ?? null }
      : { planCode: null, status: null, features: null };
    prune(now);
    cache.set(fieldId, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (err) {
    console.error("[field-plan] 讀取方案失敗（一律放行）:", err);
    return { planCode: null, status: null, features: null };
  }
}

/** 這個場域的方案有沒有這個功能（判斷不出場域 / 方案 → true） */
export async function fieldHasFeature(fieldId: string | null | undefined, featureKey: string): Promise<boolean> {
  if (!fieldId) return true;
  const plan = await loadFieldPlan(fieldId);
  return planHasFeature(plan.features, featureKey);
}
