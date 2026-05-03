// 🐛 統一錯誤紀錄工具（client + server 共用）
//
// 設計：
//   - fingerprint 聚合同源錯誤（只記一筆 + occurrenceCount + lastSeenAt）
//   - 失敗 fail-silent（log DB 失敗不能再觸發新 error）
//   - 既有 source：window-error / unhandled-rejection / boundary（client）
//   - 新增 source：server-middleware / server-route（server）
//
// 設計依據：docs/changes/2026-05-03-error-handling-audit.md Stage 1 #2 + #5

import crypto from "crypto";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { errorLogs } from "@shared/schema";

export interface LogErrorPayload {
  /** error / warning / info（預設 error） */
  level?: "error" | "warning" | "info";
  /** error message（必填） */
  message: string;
  /** stack trace（可選） */
  stack?: string;
  /** 錯誤來源分類 */
  source: string;
  /** client URL 或 server route path */
  url?: string;
  /** browser userAgent（client）*/
  userAgent?: string;
  /** "client" | "server"（預設 server、server 端 caller 通常省略） */
  platform?: "client" | "server";
  /** request id（X-Request-Id middleware 注入） */
  requestId?: string;
  /** Firebase user id（若已登入） */
  userId?: string;
  /** 場域 id */
  fieldId?: string;
  /** game session id（若 URL 含或操作關到）*/
  sessionId?: string;
  /** team id（若操作關到隊伍）*/
  teamId?: string;
  /** match id（若對戰中）*/
  matchId?: string;
  /** server 端 HTTP status */
  statusCode?: number;
  /** server 端 HTTP method */
  method?: string;
  /** server 端 route path */
  route?: string;
  /** request IP */
  ipAddress?: string;
}

/** 建 fingerprint hash 用於聚合同源錯誤 */
function buildFingerprint(payload: LogErrorPayload): string {
  const key = `${payload.platform || "server"}|${payload.message}|${payload.source}|${(payload.route || payload.url || "").slice(0, 200)}`;
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 64);
}

/**
 * 紀錄錯誤到 error_logs DB
 * 失敗 fail-silent（console.error 後返回、不再 throw）
 */
export async function logError(payload: LogErrorPayload): Promise<void> {
  try {
    const fingerprint = buildFingerprint(payload);
    const platform = payload.platform || "server";

    // 找既有同 fingerprint 未解決錯誤 → 累加 occurrenceCount
    const existing = await db.query.errorLogs.findFirst({
      where: eq(errorLogs.fingerprint, fingerprint),
    });

    if (existing && !existing.resolvedAt) {
      await db
        .update(errorLogs)
        .set({
          occurrenceCount: sql`${errorLogs.occurrenceCount} + 1`,
          lastSeenAt: new Date(),
        })
        .where(eq(errorLogs.id, existing.id));
      return;
    }

    // 新建一筆
    await db.insert(errorLogs).values({
      level: payload.level || "error",
      message: payload.message.slice(0, 2000),
      stack: payload.stack?.slice(0, 10000),
      source: payload.source,
      url: payload.url?.slice(0, 1000),
      userAgent: payload.userAgent?.slice(0, 500),
      platform,
      requestId: payload.requestId?.slice(0, 100),
      userId: payload.userId,
      fieldId: payload.fieldId,
      sessionId: payload.sessionId,
      teamId: payload.teamId,
      matchId: payload.matchId,
      statusCode: payload.statusCode,
      method: payload.method?.slice(0, 10),
      route: payload.route?.slice(0, 200),
      ipAddress: payload.ipAddress?.slice(0, 45),
      fingerprint,
      occurrenceCount: 1,
    });
  } catch (dbErr) {
    // DB 寫入失敗 fail-silent（避免 error logger 自己變新 error 來源）
    console.error("[error-logger] 寫入 error_logs 失敗:", dbErr);
  }
}
