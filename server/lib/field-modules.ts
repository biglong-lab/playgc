// 🧩 場域模組開關（P2 底座，2026-09-23）
//
// 來源：fields.settings.modules（jsonb；沒設定就用登錄表的預設值）
// 快取：30 秒 TTL —— 模組開關是低頻設定，但 API 每次請求都要判斷，不能每次打 DB
//   （同 disconnect-grace-config 的作法；讀取失敗一律放行，不能因為設定讀不到就把場域鎖死）
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fields } from "@shared/schema";
import { isCronOn, isModuleOn, resolveFieldModules, type ModuleDef } from "@shared/lib/module-registry";

const TTL_MS = 30_000;
const MAX_ENTRIES = 500;

type Modules = Record<string, boolean>;
const cache = new Map<string, { value: Modules; expiresAt: number }>();

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

/** 清掉某場域的快取（設定頁存檔後呼叫，讓變更立刻生效） */
export function invalidateFieldModules(fieldId: string): void {
  cache.delete(fieldId);
}

export async function loadFieldModules(fieldId: string): Promise<Modules> {
  const now = Date.now();
  const hit = cache.get(fieldId);
  if (hit && hit.expiresAt > now) return hit.value;
  try {
    const [row] = await db.select({ settings: fields.settings }).from(fields).where(eq(fields.id, fieldId)).limit(1);
    // 沿用舊的 enableXxx 開關（場域已經關掉的功能不能因為換機制又被打開）
    const modules = resolveFieldModules(row?.settings as Record<string, unknown> | null);
    prune(now);
    cache.set(fieldId, { value: modules, expiresAt: now + TTL_MS });
    return modules;
  } catch (err) {
    console.error("[field-modules] 讀取場域模組設定失敗（一律放行）:", err);
    return {};
  }
}

/** 這個場域有沒有開這個模組（讀不到設定 → 用登錄表預設，不擋） */
export async function isFieldModuleEnabled(fieldId: string | null | undefined, moduleKey: string): Promise<boolean> {
  if (!fieldId) return true; // 判斷不出場域就不擋（例如平台級或尚未綁場域的請求）
  return isModuleOn(await loadFieldModules(fieldId), moduleKey);
}

/**
 * 排程用：這個場域的這個排程要不要跑（模組關掉就跳過）
 * 🧩 積木鐵則 4：關掉 = API 擋、選單藏、cron 跳過
 */
export async function isFieldCronEnabled(fieldId: string | null | undefined, cronKey: string): Promise<boolean> {
  if (!fieldId) return true;
  return isCronOn(await loadFieldModules(fieldId), cronKey);
}

/** 關掉模組時要回給前端的訊息（前端可直接顯示） */
export function moduleOffMessage(def: ModuleDef): string {
  return `「${def.label}」功能目前未啟用，請場域管理員到設定中心開啟`;
}
