// /api/error-log — 前端錯誤上報 endpoint
//
// 接收 useErrorReport hook + ErrorBoundary 的 uncaught error / unhandledrejection。
// v1: 寫 console.error 為先（便於追蹤），未來可升級成 DB 表 / Sentry。
//
// 安全：
// - Rate limit：per IP 60/min
// - zod 驗證 body
// - 只記錄，不對前端動作（永遠 200，避免 error report 本身失敗又觸發 error）
import type { Express, Request, Response } from "express";
import { z } from "zod";

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

  app.post("/api/error-log", (req: Request, res: Response) => {
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

      // v1: console.error（含結構化 metadata 方便 grep）
      console.error("[client-error]", {
        message,
        source: source || "unknown",
        url: url?.slice(0, 200),
        userAgent: userAgent?.slice(0, 100),
        timestamp: timestamp || new Date().toISOString(),
        ip,
        // stack 只記前 500 字，避免 log 爆量
        stack: stack?.slice(0, 500),
      });

      return res.status(200).json({ accepted: true });
    } catch {
      // 任何異常都不讓前端知道
      return res.status(200).json({ accepted: false, reason: "server_error" });
    }
  });
}
