// /api/error-log — 前端錯誤上報 endpoint
//
// 接收 useErrorReport hook + ErrorBoundary 的 uncaught error / unhandledrejection。
// v2 (2026-04-30)：寫入 error_logs DB 表 + 同源錯誤聚合（fingerprint）
//
// 安全：
// - Rate limit：per IP 60/min
// - zod 驗證 body
// - 只記錄，不對前端動作（永遠 200，避免 error report 本身失敗又觸發 error）
import type { Express, Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "../db";
import { errorLogs } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// 🛡 簡易 IP rate-limit（per-IP 滾動視窗）
const RATE_LIMIT_WINDOW_MS = 60_000; // 60 秒
const RATE_LIMIT_MAX = 60; // 每 IP 最多 60 筆/分鐘
const ipRequestMap = new Map<string, number[]>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = ipRequestMap.get(ip) ?? [];
  const fresh = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (fresh.length >= RATE_LIMIT_MAX) {
    ipRequestMap.set(ip, fresh);
    return false;
  }
  fresh.push(now);
  ipRequestMap.set(ip, fresh);
  return true;
}

// 定期清理 rate-limit map（每 5 分鐘），避免 memory leak
let cleanupStarted = false;
function startCleanup() {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    const now = Date.now();
    ipRequestMap.forEach((timestamps: number[], ip: string) => {
      const fresh = timestamps.filter((ts: number) => now - ts < RATE_LIMIT_WINDOW_MS);
      if (fresh.length === 0) ipRequestMap.delete(ip);
      else ipRequestMap.set(ip, fresh);
    });
  }, 5 * 60_000);
}

const errorLogSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(10_000).optional(),
  source: z.string().max(100).optional(),
  url: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  timestamp: z.string().max(50).optional(),
});

export function registerErrorLogRoutes(app: Express) {
  startCleanup();

  app.post("/api/error-log", async (req: Request, res: Response) => {
    // 永遠回 200（避免前端再觸發 error loop），只在 server 端 log
    try {
      // Rate limit
      const ip = req.ip || req.socket.remoteAddress || "unknown";
      if (!checkRateLimit(ip)) {
        // Rate limited — silently drop
        return res.status(200).json({ accepted: false, reason: "rate_limited" });
      }

      // Validate body
      const parsed = errorLogSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(200).json({ accepted: false, reason: "invalid_body" });
      }
      const { message, stack, source, url, userAgent, timestamp } = parsed.data;

      // 保留 console.error（含結構化 metadata 方便 grep）
      console.error("[client-error]", {
        message,
        source: source || "unknown",
        url: url?.slice(0, 200),
        userAgent: userAgent?.slice(0, 100),
        timestamp: timestamp || new Date().toISOString(),
        ip,
        stack: stack?.slice(0, 500),
      });

      // 🆕 v2: 同時寫入 error_logs 表（含 fingerprint 聚合同源錯誤）
      try {
        const fingerprint = crypto
          .createHash("sha256")
          .update(`${message}|${source ?? ""}|${(url ?? "").slice(0, 200)}`)
          .digest("hex")
          .slice(0, 64);

        // 嘗試找同 fingerprint 的未解決錯誤 → 累計
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
        } else {
          await db.insert(errorLogs).values({
            level: "error",
            message: message.slice(0, 2000),
            stack: stack?.slice(0, 10000),
            source,
            url,
            userAgent: userAgent?.slice(0, 500),
            ipAddress: ip,
            fingerprint,
            occurrenceCount: 1,
          });
        }
      } catch (dbErr) {
        // DB 寫入失敗不影響回應（已 console.error 過了）
      }

      return res.status(200).json({ accepted: true });
    } catch {
      return res.status(200).json({ accepted: false, reason: "server_error" });
    }
  });
}
