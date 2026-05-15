// 📊 Admin Reports Health — session_reports 寫入頻率 + trend（D / 2026-05-16）
//
// 端點：GET /api/admin/metrics/reports-health
//
// 用途：
//   admin SLA dashboard 加卡顯示「session_reports 是否在累積」
//   業主 5/9 後無新報告 — 此 endpoint 揭示真相（沒新活動 vs cron 壞掉）
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (D)

import type { Express } from "express";
import { db } from "../db";
import { sessionReports } from "@shared/schema/observability";
import { gte, sql } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";

export function registerAdminReportsHealthRoutes(app: Express) {
  app.get(
    "/api/admin/metrics/reports-health",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const now = Date.now();
        const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000);

        // 1. 過去 7/30 天寫入數 + 最後一筆
        const [stats] = await db
          .select({
            total: sql<number>`count(*)::int`,
            last7d: sql<number>`count(*) filter (where ${sessionReports.createdAt} >= ${since7d})::int`,
            last30d: sql<number>`count(*) filter (where ${sessionReports.createdAt} >= ${since30d})::int`,
            latestCreatedAt: sql<string | null>`max(${sessionReports.createdAt})::text`,
            avgAnomaly: sql<number | null>`avg(${sessionReports.anomalyScore})::int`,
            telegramSent7d: sql<number>`count(*) filter (where ${sessionReports.createdAt} >= ${since7d} AND ${sessionReports.telegramSent} = true)::int`,
          })
          .from(sessionReports);

        // 2. 7 天每日寫入數 trend（GROUP BY day）
        const dailyTrend = await db.execute<{ day: string; count: number }>(sql`
          SELECT
            DATE_TRUNC('day', created_at)::date::text AS day,
            COUNT(*)::int AS count
          FROM session_reports
          WHERE created_at >= ${since7d}
          GROUP BY day
          ORDER BY day
        `);

        const dailyRows = (dailyTrend as unknown as { rows?: Array<{ day: string; count: number }> }).rows ?? [];

        // 3. 計算「最近一筆距今天數」
        let daysAgo: number | null = null;
        let severity: "ok" | "warning" | "critical" | "none" = "none";
        if (stats?.latestCreatedAt) {
          daysAgo = Math.floor(
            (now - new Date(stats.latestCreatedAt).getTime()) / (1000 * 60 * 60 * 24),
          );
          severity = daysAgo > 7 ? "critical" : daysAgo > 3 ? "warning" : "ok";
        }

        res.json({
          total: stats?.total ?? 0,
          last7d: stats?.last7d ?? 0,
          last30d: stats?.last30d ?? 0,
          latestCreatedAt: stats?.latestCreatedAt ?? null,
          daysAgo,
          severity,
          avgAnomaly: stats?.avgAnomaly ?? null,
          telegramSent7d: stats?.telegramSent7d ?? 0,
          dailyTrend: dailyRows,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-reports-health] 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );
}
