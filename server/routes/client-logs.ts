// 📊 前端日誌/錯誤收集路由
//
// POST /api/client-logs        — 批次上報（玩家端呼叫，無需 auth 但 rate-limited）
// GET  /api/admin/client-logs  — 管理員查詢（admin session）
// GET  /api/admin/client-logs/stats — 統計總覽
import type { Express, Request } from "express";
import { db } from "../db";
import { clientEvents } from "@shared/schema";
import { z } from "zod";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import type { AuthenticatedRequest } from "./types";

const eventSchema = z.object({
  eventType: z.enum(["error", "info", "milestone"]),
  category: z.string().min(1).max(50),
  code: z.string().max(100).optional(),
  message: z.string().max(2000).optional(),
  severity: z
    .enum(["critical", "error", "warning", "info", "debug"])
    .optional(),
  context: z.record(z.unknown()).optional(),
});

const batchSchema = z.object({
  events: z.array(eventSchema).min(1).max(50), // 每批最多 50 筆，防灌爆
});

// 🛡 簡易 IP rate-limit（無需裝額外套件）
// 每 IP 每分鐘最多 120 次上報（= 2000 events/min 在 50 batch 下）
const ipHits = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 120;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || rec.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  rec.count += 1;
  if (rec.count > RATE_MAX) return true;
  return false;
}

// 定期清理 rate-limit map，避免 memory leak
setInterval(() => {
  const now = Date.now();
  const expired: string[] = [];
  ipHits.forEach((rec, ip) => {
    if (rec.resetAt < now) expired.push(ip);
  });
  for (const ip of expired) ipHits.delete(ip);
}, 5 * 60_000);

function getIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

export function registerClientLogsRoutes(app: Express) {
  /**
   * 玩家端批次上報
   */
  app.post(
    "/api/client-logs",
    async (req: AuthenticatedRequest, res) => {
      const ip = getIp(req);
      if (isRateLimited(ip)) {
        // 回 204 不讓 client 知道我們 throttle（避免 attacker 掃頻率）
        return res.status(204).end();
      }

      const parsed = batchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      try {
        const userAgent = (req.headers["user-agent"] || "").substring(0, 500);
        const url = (req.headers.referer || "").substring(0, 500);
        // 盡量關聯到使用者（若已登入；未登入也允許匿名上報）
        const userId = req.user?.claims?.sub || null;

        const rows = parsed.data.events.map((ev) => ({
          eventType: ev.eventType,
          category: ev.category,
          code: ev.code ?? null,
          message: ev.message ?? null,
          severity: ev.severity ?? "info",
          context: ev.context ?? null,
          userId,
          userAgent,
          url,
        }));

        await db.insert(clientEvents).values(rows);
        res.status(204).end();
      } catch (err) {
        // 日誌系統自己 fail 不應影響玩家 → 仍回 204 silent
        console.error("[client-logs] insert failed:", err);
        res.status(204).end();
      }
    },
  );

  /**
   * 管理員查詢日誌
   * Query: ?severity=error&category=camera&since=2026-04-22T10:00:00&limit=100&offset=0
   */
  app.get(
    "/api/admin/client-logs",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const limit = Math.min(parseInt(String(req.query.limit)) || 100, 500);
        const offset = Math.max(parseInt(String(req.query.offset)) || 0, 0);

        const conditions = [];
        if (req.query.severity) {
          conditions.push(eq(clientEvents.severity, String(req.query.severity)));
        }
        if (req.query.category) {
          conditions.push(eq(clientEvents.category, String(req.query.category)));
        }
        if (req.query.eventType) {
          conditions.push(eq(clientEvents.eventType, String(req.query.eventType)));
        }
        if (req.query.userId) {
          conditions.push(eq(clientEvents.userId, String(req.query.userId)));
        }
        if (req.query.since) {
          const sinceDate = new Date(String(req.query.since));
          if (!isNaN(sinceDate.getTime())) {
            conditions.push(gte(clientEvents.createdAt, sinceDate));
          }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const rows = await db
          .select()
          .from(clientEvents)
          .where(whereClause)
          .orderBy(desc(clientEvents.createdAt))
          .limit(limit)
          .offset(offset);

        res.json({ events: rows, limit, offset });
      } catch (err) {
        console.error("[client-logs] query failed:", err);
        res.status(500).json({ message: "查詢失敗" });
      }
    },
  );

  /**
   * 統計總覽：近 24h 各類錯誤數量
   */
  app.get(
    "/api/admin/client-logs/stats",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const since = new Date(Date.now() - 24 * 3600 * 1000);

        // 依 severity 分組
        const bySeverity = await db
          .select({
            severity: clientEvents.severity,
            count: sql<number>`count(*)::int`,
          })
          .from(clientEvents)
          .where(gte(clientEvents.createdAt, since))
          .groupBy(clientEvents.severity);

        // 依 category 分組（限定 error 或 critical）
        const byCategory = await db
          .select({
            category: clientEvents.category,
            code: clientEvents.code,
            count: sql<number>`count(*)::int`,
          })
          .from(clientEvents)
          .where(
            and(
              gte(clientEvents.createdAt, since),
              sql`${clientEvents.severity} IN ('error', 'critical')`,
            ),
          )
          .groupBy(clientEvents.category, clientEvents.code)
          .orderBy(desc(sql`count(*)`))
          .limit(20);

        // 總筆數
        const [total] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(clientEvents)
          .where(gte(clientEvents.createdAt, since));

        res.json({
          total: total.count,
          bySeverity,
          topErrors: byCategory,
          since: since.toISOString(),
        });
      } catch (err) {
        console.error("[client-logs] stats failed:", err);
        res.status(500).json({ message: "統計失敗" });
      }
    },
  );
}

/**
 * 🧹 定期清理：7 天以上的日誌自動刪除（避免 DB 肥大）
 * 每 6 小時跑一次
 */
export function startClientLogsCleanup() {
  const cleanup = async () => {
    try {
      const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const result = await db
        .delete(clientEvents)
        .where(sql`${clientEvents.createdAt} < ${cutoff}`);
      console.log(`[client-logs] cleaned up events older than 7d`);
      void result; // 避免 TS 警告
    } catch (err) {
      console.error("[client-logs] cleanup failed:", err);
    }
  };
  // 啟動 5 分鐘後跑一次，之後每 6 小時
  setTimeout(cleanup, 5 * 60_000);
  setInterval(cleanup, 6 * 3600 * 1000);
}
