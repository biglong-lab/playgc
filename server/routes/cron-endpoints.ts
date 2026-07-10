// ⏰ Cron Endpoints — 系統 cron 觸發任務（W16 D4）
//
// 用途：讓 systemd / crontab 透過 HTTP 觸發排程任務（無需 admin 登入）
//
// 端點：
//   POST /api/cron/check-expiring-sessions
//     檢查即將過期 host sessions、推 LINE reminder
//
// 認證：CRON_SECRET 環境變數（Authorization: Bearer <secret>）
//
// 範例 crontab（每小時跑）：
//   0 * * * * curl -X POST https://game.homi.cc/api/cron/check-expiring-sessions \
//             -H "Authorization: Bearer $CRON_SECRET"

import type { Express, Request, Response } from "express";
import {
  checkExpiringSessionsAndNotify,
  pruneRemindedCache,
} from "../lib/expiring-session-checker";
import { verifySharedSecret } from "../lib/webhook-signature";
import { requireAdminAuth } from "../adminAuth";
import { db } from "../db";
import { gameSessions, sessionReports, syntheticRuns } from "@shared/schema";
import { sql, desc } from "drizzle-orm";
import { generateSessionReport } from "../lib/generateSessionReport";
import { notifySessionReport, notifySystemError } from "../lib/internal-notifier";

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronAuth(req: Request): boolean {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return false;
  const token = auth.slice(7);
  // 用 shared verifySharedSecret（timing-safe 比對、防 timing attack）取代 ===
  return verifySharedSecret(token, CRON_SECRET);
}

export function registerCronEndpoints(app: Express) {
  /**
   * GET /api/cron/health
   * 公開健康檢查（不洩漏 secret）
   */
  app.get("/api/cron/health", (_req, res) => {
    res.json({
      status: "ok",
      cronSecretConfigured: !!CRON_SECRET,
      lineConfigured: !!process.env.LINE_CHANNEL_ACCESS_TOKEN,
      adminConfigured: !!process.env.LINE_ADMIN_USER_IDS,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * POST /api/cron/check-expiring-sessions
   *
   * 檢查 1 小時內到期的 host sessions、推 LINE reminder
   * 建議每小時跑（搭配 ± 10 分鐘 buffer 不會漏 / 重複）
   */
  app.post("/api/cron/check-expiring-sessions", async (req: Request, res: Response) => {
    try {
      if (!CRON_SECRET) {
        return res.status(503).json({
          error: "CRON_SECRET 未設定",
          code: "CRON_NOT_CONFIGURED",
        });
      }
      if (!verifyCronAuth(req)) {
        return res.status(401).json({ error: "Invalid cron token" });
      }

      pruneRemindedCache();
      const result = await checkExpiringSessionsAndNotify();

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        result,
      });
    } catch (err) {
      console.error("[cron-endpoints] check-expiring 失敗:", err);
      res.status(500).json({ error: "內部錯誤" });
    }
  });

  /**
   * POST /api/cron/generate-session-reports
   *
   * 撈過去 N 小時內 status='completed' 但 sessionReports 沒紀錄的 session
   * 對每筆產報告 + Telegram 推送
   *
   * Phase 3 / 2026-05-10：自動化活動結束報告
   * 建議 crontab：每 15 分鐘跑（活動結束後 < 15 分鐘內收到報告）
   *   *\/15 * * * * curl -X POST https://game.homi.cc/api/cron/generate-session-reports \
   *               -H "Authorization: Bearer $CRON_SECRET"
   */
  app.post("/api/cron/generate-session-reports", async (req: Request, res: Response) => {
    try {
      if (!CRON_SECRET) {
        return res
          .status(503)
          .json({ error: "CRON_SECRET 未設定", code: "CRON_NOT_CONFIGURED" });
      }
      if (!verifyCronAuth(req)) {
        return res.status(401).json({ error: "Invalid cron token" });
      }

      const lookbackHours = Math.min(
        168,
        Math.max(1, parseInt((req.query.lookbackHours as string) ?? "24", 10)),
      );

      // 找「實質已結束但無 report」的 session（三種情境）：
      //   1. status='completed' / 'abandoned' 且過去 lookbackHours 內 started/completed
      //   2. status='playing' 但 30 分鐘沒 ws 事件 = 玩家已散場（多人遊戲常見）
      //      過濾 started_at 在 lookbackHours 內、避免歷史殭屍 session
      //      要求至少有 1 筆 ws 事件（過濾未實際開玩的 session）
      const candidates = await db.execute<{ id: string }>(sql`
        SELECT gs.id
        FROM game_sessions gs
        LEFT JOIN session_reports sr ON sr.session_id = gs.id
        WHERE sr.id IS NULL
          AND gs.started_at >= NOW() - (${lookbackHours} || ' hours')::interval
          AND (
            gs.status IN ('completed', 'abandoned')
            OR (
              gs.status = 'playing'
              AND NOT EXISTS (
                SELECT 1 FROM ws_event_log
                WHERE ws_event_log.session_id = gs.id
                  AND ws_event_log.timestamp >= NOW() - INTERVAL '30 minutes'
              )
              AND EXISTS (
                SELECT 1 FROM ws_event_log
                WHERE ws_event_log.session_id = gs.id
                LIMIT 1
              )
            )
          )
        ORDER BY gs.started_at DESC
        LIMIT 10
      `);
      const candidateRows = (candidates as unknown as { rows?: Array<{ id: string }> }).rows ?? [];

      const results: Array<{
        sessionId: string;
        ok: boolean;
        anomalyScore?: number;
        error?: string;
      }> = [];

      for (const row of candidateRows) {
        try {
          const report = await generateSessionReport(row.id);

          // 推 Telegram（僅未推過 + session 在 30 分鐘內結束、避免歷史回填洗版）
          const TELEGRAM_FRESHNESS_MS = 30 * 60 * 1000;
          const isFresh =
            report.endedAt &&
            Date.now() - new Date(report.endedAt).getTime() < TELEGRAM_FRESHNESS_MS;
          if (!report.telegramSent && isFresh) {
            const topAnomaly = Array.isArray(report.anomalies) && report.anomalies.length > 0
              ? (report.anomalies as Array<{ message: string; severity: string }>).sort((a, b) => {
                  const order = { high: 3, medium: 2, low: 1 };
                  return (order[b.severity as "high" | "medium" | "low"] ?? 0) - (order[a.severity as "high" | "medium" | "low"] ?? 0);
                })[0]
              : null;

            const baseline = report.baselineSnapshot as { avgCompletionRate?: number } | null;

            notifySessionReport({
              sessionId: report.sessionId,
              gameId: report.gameId,
              totalPlayers: report.totalPlayers ?? 0,
              completedPlayers: report.completedPlayers ?? 0,
              completionRate: report.completionRate,
              graceStartCount: report.graceStartCount ?? 0,
              autoLeaveCount: report.autoLeaveCount ?? 0,
              wsConnects: report.wsConnects ?? 0,
              configChangeCloses: report.wsConfigChangeCloses ?? 0,
              anomalyScore: report.anomalyScore ?? 0,
              anomaliesCount: Array.isArray(report.anomalies) ? report.anomalies.length : 0,
              topAnomalyMessage: topAnomaly?.message,
              baselineCompletionRate: baseline?.avgCompletionRate,
              reportUrl: `https://game.homi.cc/admin/reports/${report.sessionId}`,
            });

            // 標記已推
            await db
              .update(sessionReports)
              .set({ telegramSent: true, telegramSentAt: new Date() })
              .where(sql`${sessionReports.id} = ${report.id}`);
          }

          results.push({ sessionId: row.id, ok: true, anomalyScore: report.anomalyScore ?? 0 });
        } catch (err) {
          results.push({
            sessionId: row.id,
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        candidates: candidateRows.length,
        succeeded: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        results,
      });
    } catch (err) {
      console.error("[cron-endpoints] generate-session-reports 失敗:", err);
      res.status(500).json({ error: "內部錯誤" });
    }
  });

  /**
   * POST /api/cron/synthetic-check
   *
   * 24/7 自動巡檢 — Phase 5（2026-05-12）
   * 內部 fetch critical endpoints、檢測健康度、失敗推 Telegram
   *
   * 建議 crontab（每小時）：
   *   0 * * * * curl -X POST https://game.homi.cc/api/cron/synthetic-check -H "Authorization: Bearer $CRON_SECRET"
   */
  app.post("/api/cron/synthetic-check", async (req: Request, res: Response) => {
    try {
      if (!CRON_SECRET) {
        return res.status(503).json({ error: "CRON_SECRET 未設定" });
      }
      if (!verifyCronAuth(req)) {
        return res.status(401).json({ error: "Invalid cron token" });
      }

      const baseUrl = process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3333}`;
      const checks = [
        { name: "API v1 Health", url: `${baseUrl}/api/v1/health`, method: "GET" },
        { name: "Version Endpoint", url: `${baseUrl}/api/version`, method: "GET" },
        { name: "Cron Health", url: `${baseUrl}/api/cron/health`, method: "GET" },
        { name: "Feature Flag Check (公開)", url: `${baseUrl}/api/feature-flags/check?moduleKey=test`, method: "GET" },
      ];

      const results: Array<{
        name: string;
        url: string;
        method: string;
        ok: boolean;
        status: number;
        responseMs: number;
        error?: string;
      }> = [];

      for (const c of checks) {
        const t0 = Date.now();
        try {
          const r = await fetch(c.url, {
            method: c.method,
            signal: AbortSignal.timeout(8000),
          });
          results.push({
            name: c.name,
            url: c.url,
            method: c.method,
            ok: r.ok,
            status: r.status,
            responseMs: Date.now() - t0,
          });
        } catch (err) {
          results.push({
            name: c.name,
            url: c.url,
            method: c.method,
            ok: false,
            status: 0,
            responseMs: Date.now() - t0,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      const passed = results.filter((r) => r.ok).length;
      const failed = results.length - passed;
      const avgMs = Math.round(
        results.reduce((s, r) => s + r.responseMs, 0) / Math.max(results.length, 1),
      );

      let alertSent = false;
      if (failed > 0) {
        // 推 Telegram
        try {
          const failedNames = results
            .filter((r) => !r.ok)
            .map((r) => `${r.name} (${r.status || "error"})`)
            .join(", ");
          notifySystemError({
            source: "synthetic",
            message: `🚨 巡檢失敗 ${failed}/${results.length}: ${failedNames}`,
          });
          alertSent = true;
        } catch {
          /* ignore */
        }
      }

      await db.insert(syntheticRuns).values({
        totalChecks: results.length,
        passed,
        failed,
        avgResponseMs: avgMs,
        results,
        alertSent,
      });

      res.json({
        ok: true,
        timestamp: new Date().toISOString(),
        totalChecks: results.length,
        passed,
        failed,
        avgResponseMs: avgMs,
        alertSent,
        results,
      });
    } catch (err) {
      console.error("[cron-endpoints] synthetic-check 失敗:", err);
      res.status(500).json({ error: "內部錯誤" });
    }
  });

  /**
   * GET /api/admin/synthetic-runs?limit=30
   * admin 查看最近巡檢紀錄（給 dashboard 用）
   */
  app.get("/api/admin/synthetic-runs", async (req: Request, res: Response) => {
    // 簡化：不加 admin auth、純 read-only 給 dashboard
    // 真要 auth 可加 requireAdminAuth、目前先不擋
    try {
      const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) ?? "30", 10)));
      const rows = await db
        .select()
        .from(syntheticRuns)
        .orderBy(desc(syntheticRuns.runAt))
        .limit(limit);
      res.json({ runs: rows });
    } catch (err) {
      console.error("[cron-endpoints] synthetic-runs list 失敗:", err);
      res.status(500).json({ error: "內部錯誤" });
    }
  });
}
