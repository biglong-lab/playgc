// ⏱️ 多人遊戲斷線寬限期 — 執行時讀場域設定（2026-09-23）
//
// 過去 websocket.ts 在啟動時讀環境變數成常數，場域設定頁存的值永遠讀不到、改了要重啟。
// 現在每次斷線時依「隊伍 → 遊戲 → 場域」讀 fields.settings，30 秒 TTL 快取（改設定後 30 秒內生效）。
// 優先序：場域設定（合法值）> 環境變數 DISCONNECT_GRACE_MS / AUTO_LEAVE_AFTER_GRACE_MS > 內建 30s / 120s
import { eq } from "drizzle-orm";
import { db } from "../db";
import { fields, games, teams } from "@shared/schema";
import { DISCONNECT_GRACE_LIMITS, normalizeSeconds } from "@shared/lib/disconnect-grace";

export interface GraceConfig {
  /** 斷線後的寬限期（毫秒） */
  graceMs: number;
  /** 寬限期過後到自動離隊（毫秒） */
  autoLeaveMs: number;
}

export const GRACE_CONFIG_TTL_MS = 30_000;
const MAX_CACHE_ENTRIES = 1_000;

function parseEnvMs(v: string | undefined, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 1000 || n > 600_000) return fallback;
  return n;
}

/** 環境變數 / 內建預設（場域沒設定時使用） */
export const ENV_GRACE_CONFIG: GraceConfig = {
  graceMs: parseEnvMs(process.env.DISCONNECT_GRACE_MS, DISCONNECT_GRACE_LIMITS.graceSec.default * 1000),
  autoLeaveMs: parseEnvMs(process.env.AUTO_LEAVE_AFTER_GRACE_MS, DISCONNECT_GRACE_LIMITS.autoLeaveSec.default * 1000),
};

/** 場域設定（秒）→ 計時器設定（毫秒）；不合法的項目用 fallback */
export function resolveGraceConfig(settings: unknown, fallback: GraceConfig): GraceConfig {
  if (!settings || typeof settings !== "object") return fallback;
  const s = settings as Record<string, unknown>;
  const graceSec = normalizeSeconds(s.disconnectGracePeriodSec, DISCONNECT_GRACE_LIMITS.graceSec);
  const autoLeaveSec = normalizeSeconds(s.autoLeaveAfterGraceSec, DISCONNECT_GRACE_LIMITS.autoLeaveSec);
  return {
    graceMs: graceSec !== undefined ? graceSec * 1000 : fallback.graceMs,
    autoLeaveMs: autoLeaveSec !== undefined ? autoLeaveSec * 1000 : fallback.autoLeaveMs,
  };
}

/** 讀隊伍所屬場域的 settings（隊伍 → 遊戲 → 場域）；找不到回 null */
export async function loadTeamFieldSettings(teamId: string): Promise<unknown> {
  const [row] = await db
    .select({ settings: fields.settings })
    .from(teams)
    .innerJoin(games, eq(teams.gameId, games.id))
    .innerJoin(fields, eq(games.fieldId, fields.id))
    .where(eq(teams.id, teamId))
    .limit(1);
  return row?.settings ?? null;
}

interface CacheOptions {
  ttlMs?: number;
  now?: () => number;
  fallback?: GraceConfig;
}

/** 建立依隊伍快取的讀取器；讀取失敗回 fallback 且不快取（下次再試），永不丟錯 */
export function createGraceConfigCache(load: (teamId: string) => Promise<unknown>, options: CacheOptions = {}) {
  const ttlMs = options.ttlMs ?? GRACE_CONFIG_TTL_MS;
  const now = options.now ?? Date.now;
  const fallback = options.fallback ?? ENV_GRACE_CONFIG;
  const cache = new Map<string, { value: GraceConfig; expiresAt: number }>();

  function prune(at: number) {
    if (cache.size < MAX_CACHE_ENTRIES) return;
    cache.forEach((entry, key) => {
      if (entry.expiresAt <= at) cache.delete(key);
    });
  }

  return async function getGraceConfig(teamId: string): Promise<GraceConfig> {
    const hit = cache.get(teamId);
    if (hit && hit.expiresAt > now()) return hit.value;
    try {
      const value = resolveGraceConfig(await load(teamId), fallback);
      prune(now());
      cache.set(teamId, { value, expiresAt: now() + ttlMs });
      return value;
    } catch {
      // 讀取失敗不阻塞斷線流程：用預設值、不快取
      return fallback;
    }
  };
}

/** websocket 用：隊伍的斷線寬限期設定（30 秒快取） */
export const getTeamGraceConfig = createGraceConfigCache(loadTeamFieldSettings);
