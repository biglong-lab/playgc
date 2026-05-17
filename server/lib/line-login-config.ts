// 🔐 LINE Login 全域設定 resolver（2026-05-18）
//
// 用途：auth-line-login.ts 取 channel ID / secret / callbackUrl
// 優先序：DB（platform admin 後台填）→ env（向下相容）→ unconfigured

import { db } from "../db";
import { lineLoginConfig } from "@shared/schema";
import { eq } from "drizzle-orm";

const SINGLETON_ID = "singleton";

export interface LineLoginConfigResolved {
  channelId: string | null;
  channelSecret: string | null;
  callbackUrl: string | null;
  source: "db" | "env" | "none";
}

let cache: { config: LineLoginConfigResolved; expires: number } | null = null;
const CACHE_TTL_MS = 10_000;

export async function getLineLoginConfig(): Promise<LineLoginConfigResolved> {
  if (cache && cache.expires > Date.now()) return cache.config;

  let resolved: LineLoginConfigResolved = {
    channelId: null,
    channelSecret: null,
    callbackUrl: null,
    source: "none",
  };

  try {
    const [row] = await db
      .select()
      .from(lineLoginConfig)
      .where(eq(lineLoginConfig.id, SINGLETON_ID))
      .limit(1);

    if (row && row.enabled && row.channelId && row.channelSecret) {
      resolved = {
        channelId: row.channelId,
        channelSecret: row.channelSecret,
        callbackUrl: row.callbackUrl ?? null,
        source: "db",
      };
    }
  } catch (err) {
    console.warn("[line-login-config] DB 查詢失敗、走 env fallback:", err);
  }

  if (resolved.source === "none") {
    const envId = process.env.LINE_LOGIN_CHANNEL_ID;
    const envSecret = process.env.LINE_LOGIN_CHANNEL_SECRET;
    const envCb = process.env.LINE_LOGIN_CALLBACK_URL;
    if (envId && envSecret) {
      resolved = {
        channelId: envId,
        channelSecret: envSecret,
        callbackUrl: envCb ?? null,
        source: "env",
      };
    }
  }

  cache = { config: resolved, expires: Date.now() + CACHE_TTL_MS };
  return resolved;
}

export function invalidateLineLoginConfigCache(): void {
  cache = null;
}

export const LINE_LOGIN_SINGLETON_ID = SINGLETON_ID;
