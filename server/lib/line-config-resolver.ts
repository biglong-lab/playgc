// 🔗 LINE Config Resolver — per-field LINE channel 動態查找（2026-05-17）
//
// 用途：
//   line-pusher / line-webhook / LIFF 不再硬寫死 process.env
//   呼叫時帶 fieldId、優先查 fields.lineChannel* + lineEnabled='true'
//   找不到或未啟用 → fallback env LINE_CHANNEL_*（向下相容）
//
// 業主需求：每館獨立 LINE channel、賈村先實測、其他場域後續加

import { db } from "../db";
import { fields } from "@shared/schema";
import { eq, sql, or } from "drizzle-orm";

export interface LineChannelConfig {
  /** 從哪裡取的：field（per-field）或 env（全域 fallback）*/
  source: "field" | "env" | "none";
  channelId: string | null;
  channelSecret: string | null;
  accessToken: string | null;
  liffId: string | null;
}

// In-memory cache（10 秒、避免每次 push 都 DB query）
// fieldId → { config, expires }
const cache = new Map<string, { config: LineChannelConfig; expires: number }>();
const CACHE_TTL_MS = 10_000;

/**
 * 取場域 LINE 設定
 *   - fieldId 為 null/undefined → 直接走 env
 *   - 有 fieldId → 查 DB（lineEnabled='true'）→ 找到回 field 設定、否則 env
 *   - 兩者都無 → source='none'（呼叫方應跳過 LINE 動作）
 */
export async function resolveLineConfig(fieldId?: string | null): Promise<LineChannelConfig> {
  // 場域查找（per-field）
  if (fieldId) {
    const cached = cache.get(fieldId);
    if (cached && cached.expires > Date.now()) return cached.config;

    try {
      const [row] = await db
        .select({
          lineChannelId: fields.lineChannelId,
          lineChannelSecret: fields.lineChannelSecret,
          lineChannelAccessToken: fields.lineChannelAccessToken,
          lineLiffId: fields.lineLiffId,
          lineEnabled: fields.lineEnabled,
        })
        .from(fields)
        .where(eq(fields.id, fieldId))
        .limit(1);

      if (row && row.lineEnabled === "true" && row.lineChannelAccessToken) {
        const config: LineChannelConfig = {
          source: "field",
          channelId: row.lineChannelId ?? null,
          channelSecret: row.lineChannelSecret ?? null,
          accessToken: row.lineChannelAccessToken,
          liffId: row.lineLiffId ?? null,
        };
        cache.set(fieldId, { config, expires: Date.now() + CACHE_TTL_MS });
        return config;
      }
    } catch (err) {
      console.warn("[line-config-resolver] DB 查詢失敗、走 env fallback:", err);
    }
  }

  // Fallback env（全域）
  const envToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (envToken) {
    return {
      source: "env",
      channelId: process.env.LINE_CHANNEL_ID ?? null,
      channelSecret: process.env.LINE_CHANNEL_SECRET ?? null,
      accessToken: envToken,
      liffId: process.env.LIFF_ID ?? null,
    };
  }

  return { source: "none", channelId: null, channelSecret: null, accessToken: null, liffId: null };
}

/**
 * 反查：依 LINE Channel ID 找對應 fieldId（給 webhook 路由用）
 * 用 lower() 做大小寫不敏感比對
 */
export async function findFieldIdByLineChannelId(channelId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ id: fields.id })
      .from(fields)
      .where(sql`lower(${fields.lineChannelId}) = lower(${channelId}) AND ${fields.lineEnabled} = 'true'`)
      .limit(1);
    return row?.id ?? null;
  } catch (err) {
    console.warn("[line-config-resolver] channelId 反查失敗:", err);
    return null;
  }
}

/**
 * 手動清快取（admin 改設定後呼叫）
 */
export function invalidateLineConfigCache(fieldId?: string): void {
  if (fieldId) {
    cache.delete(fieldId);
  } else {
    cache.clear();
  }
}
