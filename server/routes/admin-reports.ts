// 📊 Admin Reports — 活動結束自動報告（Phase 3 / 2026-05-10）
//
// 端點：
//   GET  /api/admin/reports?limit=50&minAnomaly=0
//     列表（最新優先、可篩異常分數）
//
//   GET  /api/admin/reports/:sessionId
//     詳情（含 ws_event_log 統計、anomalies、baseline）
//
//   POST /api/admin/reports/:sessionId/generate
//     手動觸發產生（idempotent UPSERT）

import type { Express } from "express";
import { db } from "../db";
import { sessionReports } from "@shared/schema";
import { eq, desc, gte, and } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { generateSessionReport } from "../lib/generateSessionReport";

export function registerAdminReportsRoutes(app: Express) {
  // ─── GET 列表 ─────────────────────────────────────────────
  app.get(
    "/api/admin/reports",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const limit = Math.min(200, Math.max(1, parseInt((req.query.limit as string) ?? "50", 10)));
        const minAnomaly = Math.max(0, parseInt((req.query.minAnomaly as string) ?? "0", 10));

        const conditions = minAnomaly > 0 ? [gte(sessionReports.anomalyScore, minAnomaly)] : [];
        const rows = await db
          .select()
          .from(sessionReports)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(sessionReports.createdAt))
          .limit(limit);

        res.json({ reports: rows, count: rows.length });
      } catch (err) {
        console.error("[admin-reports] list failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );

  // ─── GET 詳情 ─────────────────────────────────────────────
  app.get(
    "/api/admin/reports/:sessionId",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const [report] = await db
          .select()
          .from(sessionReports)
          .where(eq(sessionReports.sessionId, sessionId))
          .limit(1);

        if (!report) {
          return res.status(404).json({ error: "報告未產生、可手動觸發 POST /generate" });
        }
        res.json({ report });
      } catch (err) {
        console.error("[admin-reports] detail failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "查詢失敗" });
      }
    },
  );

  // ─── POST 手動觸發（idempotent UPSERT）──────────────────────
  app.post(
    "/api/admin/reports/:sessionId/generate",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        const { sessionId } = req.params;
        const report = await generateSessionReport(sessionId);
        res.json({ ok: true, report });
      } catch (err) {
        console.error("[admin-reports] generate failed:", err);
        res.status(500).json({ error: err instanceof Error ? err.message : "產生失敗" });
      }
    },
  );
}
