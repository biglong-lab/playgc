// 📣 場域級 Telegram 群組（P2 底座，2026-09-23）
//
// 現況：通知一律送到環境變數 TELEGRAM_FIELD_GROUP_CHAT_IDS 指定的群組（賈村）。
//   多場域之後，後浦的預約不該通報到賈村的群組。
//
// 作法（相容優先）：
//   場域自己設了群組（fields.settings.telegram.chatIds）→ 送自己的
//   沒設 → 沿用環境變數（現有行為完全不變）
// 快取 60 秒；讀取失敗回退環境變數。
import { eq } from "drizzle-orm";
import { fields } from "@shared/schema";
import { getFieldGroupChatIds } from "./telegram-bot";

export interface FieldTelegramConfig {
  chatIds?: string[];
  enabled?: boolean;
}

const TTL_MS = 60_000;
const MAX_ENTRIES = 300;
const cache = new Map<string, { value: FieldTelegramConfig; expiresAt: number }>();

export function invalidateFieldTelegram(fieldId: string): void {
  cache.delete(fieldId);
}

/** chat id 基本格式：Telegram 是數字（群組為負數） */
export function isValidChatId(value: unknown): value is string {
  return typeof value === "string" && /^-?\d{5,20}$/.test(value.trim());
}

/** 清洗要存的設定（最多 5 個群組、格式不對的丟掉） */
export function sanitizeFieldTelegram(raw: unknown): FieldTelegramConfig {
  const input = (raw ?? {}) as { chatIds?: unknown; enabled?: unknown };
  const chatIds = Array.isArray(input.chatIds)
    ? input.chatIds.map((v) => String(v).trim()).filter(isValidChatId).slice(0, 5)
    : [];
  return { chatIds, enabled: input.enabled !== false };
}

async function loadConfig(fieldId: string): Promise<FieldTelegramConfig> {
  const now = Date.now();
  const hit = cache.get(fieldId);
  if (hit && hit.expiresAt > now) return hit.value;
  try {
    // 延遲載入 db：這支被通知模組載入，不能讓「沒有資料庫」的環境（CI / 單元測試）一載入就炸
    const { db } = await import("../db");
    const [row] = await db.select({ settings: fields.settings }).from(fields).where(eq(fields.id, fieldId)).limit(1);
    const value = ((row?.settings as { telegram?: FieldTelegramConfig } | null)?.telegram ?? {}) as FieldTelegramConfig;
    if (cache.size >= MAX_ENTRIES) cache.clear();
    cache.set(fieldId, { value, expiresAt: now + TTL_MS });
    return value;
  } catch (err) {
    console.error("[field-telegram] 讀取場域通知設定失敗（回退環境變數）:", err);
    return {};
  }
}

/**
 * 這則通知要送到哪些群組
 * - 場域設了自己的群組 → 用自己的（關閉則不送）
 * - 沒設 / 判斷不出場域 → 環境變數（維持現有行為）
 */
export async function resolveFieldChatIds(fieldId?: string | null): Promise<string[]> {
  if (!fieldId) return getFieldGroupChatIds();
  const cfg = await loadConfig(fieldId);
  if (cfg.enabled === false) return [];
  return cfg.chatIds && cfg.chatIds.length > 0 ? cfg.chatIds : getFieldGroupChatIds();
}
