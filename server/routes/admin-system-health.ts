// 📊 admin-system-health — Admin 即時健康儀表
//
// 用途：使用者反饋「不要等到客訴才知道」
// 設計：
//   - 聚合 error_logs 過去 N 小時資料
//   - 每 5 秒最多查 1 次（in-memory cache）
//   - 純讀、不影響系統效能
//   - 限 super_admin / field_director

import type { Express, Response } from "express";
import { requireAdminAuth } from "../adminAuth";
import { db } from "../db";
import { errorLogs, schedulerRuns } from "@shared/schema";
import { sql, and, gte, desc, eq } from "drizzle-orm";

interface HealthStats {
  windowHours: number;
  totalErrors: number;
  totalOccurrences: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    source: string;
    occurrenceCount: number;
    lastSeenAt: string | null;
  }>;
  byPlatform: Record<string, number>;
  generatedAt: string;
}

// 5 秒 cache（避免高頻查詢拖慢 DB）
const CACHE_TTL_MS = 5_000;
const cacheMap = new Map<number, { data: HealthStats; expiresAt: number }>();

export function registerAdminSystemHealthRoutes(app: Express): void {
  /**
   * GET /api/admin/system-health?hours=1
   * 過去 N 小時錯誤聚合（預設 1 小時、上限 168=7 天）
   */
  app.get(
    "/api/admin/system-health",
    requireAdminAuth,
    async (req, res: Response) => {
      try {
        const hoursRaw = parseInt(String(req.query.hours ?? "1"), 10);
        const hours = Math.max(1, Math.min(Number.isFinite(hoursRaw) ? hoursRaw : 1, 168));

        // 查 cache
        const cached = cacheMap.get(hours);
        if (cached && Date.now() < cached.expiresAt) {
          return res.json(cached.data);
        }

        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        // 1. 總錯誤類型 + 總發生次數
        const totals = await db
          .select({
            totalErrors: sql<number>`count(*)::int`,
            totalOccurrences: sql<number>`coalesce(sum(${errorLogs.occurrenceCount}), 0)::int`,
          })
          .from(errorLogs)
          .where(gte(errorLogs.createdAt, since));

        // 2. Top 5 錯誤（按 occurrenceCount 降冪）
        const topRaw = await db
          .select({
            fingerprint: errorLogs.fingerprint,
            message: errorLogs.message,
            source: errorLogs.source,
            occurrenceCount: errorLogs.occurrenceCount,
            lastSeenAt: errorLogs.lastSeenAt,
          })
          .from(errorLogs)
          .where(gte(errorLogs.createdAt, since))
          .orderBy(sql`${errorLogs.occurrenceCount} desc`)
          .limit(5);

        // 3. 按 platform 分組（client / server）
        const platformRows = await db
          .select({
            platform: errorLogs.platform,
            count: sql<number>`coalesce(sum(${errorLogs.occurrenceCount}), 0)::int`,
          })
          .from(errorLogs)
          .where(gte(errorLogs.createdAt, since))
          .groupBy(errorLogs.platform);

        const byPlatform: Record<string, number> = {};
        for (const row of platformRows) {
          byPlatform[row.platform ?? "unknown"] = row.count;
        }

        const stats: HealthStats = {
          windowHours: hours,
          totalErrors: totals[0]?.totalErrors ?? 0,
          totalOccurrences: totals[0]?.totalOccurrences ?? 0,
          topErrors: topRaw.map((r) => ({
            fingerprint: r.fingerprint ?? "",
            message: (r.message ?? "").slice(0, 200),
            source: r.source ?? "",
            occurrenceCount: r.occurrenceCount ?? 0,
            lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null,
          })),
          byPlatform,
          generatedAt: new Date().toISOString(),
        };

        cacheMap.set(hours, { data: stats, expiresAt: Date.now() + CACHE_TTL_MS });
        res.json(stats);
      } catch (err) {
        console.error("[system-health] 失敗:", err);
        res.status(500).json({ message: "查詢失敗" });
      }
    },
  );

  /**
   * GET /api/admin/scheduler-runs?name=battle-scheduler&limit=50
   * scheduler 執行歷史（2026-07-10）— 回答「上次跑何時、成功嗎、處理幾筆」
   */
  app.get(
    "/api/admin/scheduler-runs",
    requireAdminAuth,
    async (req, res: Response) => {
      try {
        const limitRaw = parseInt(String(req.query.limit ?? "50"), 10);
        const limit = Math.max(1, Math.min(Number.isFinite(limitRaw) ? limitRaw : 50, 200));
        const name = typeof req.query.name === "string" ? req.query.name : undefined;

        const rows = await db
          .select()
          .from(schedulerRuns)
          .where(name ? eq(schedulerRuns.schedulerName, name) : undefined)
          .orderBy(desc(schedulerRuns.finishedAt))
          .limit(limit);

        res.json({ runs: rows });
      } catch (err) {
        console.error("[scheduler-runs] 查詢失敗:", err);
        res.status(500).json({ message: "查詢失敗" });
      }
    },
  );
}
