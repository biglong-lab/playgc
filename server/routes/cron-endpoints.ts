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
import { db } from "../db";
import { gameSessions, sessionReports } from "@shared/schema";
import { sql } from "drizzle-orm";
import { generateSessionReport } from "../lib/generateSessionReport";
import { notifySessionReport } from "../lib/internal-notifier";

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
        72,
        Math.max(1, parseInt((req.query.lookbackHours as string) ?? "24", 10)),
      );

      // 找已 completed 但無 report 的 session（過去 N 小時內）
      const candidates = await db.execute<{ id: string }>(sql`
        SELECT gs.id
        FROM game_sessions gs
        LEFT JOIN session_reports sr ON sr.session_id = gs.id
        WHERE gs.status = 'completed'
          AND gs.completed_at >= NOW() - (${lookbackHours} || ' hours')::interval
          AND sr.id IS NULL
        LIMIT 50
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

          // 推 Telegram（僅未推過）
          if (!report.telegramSent) {
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
}
