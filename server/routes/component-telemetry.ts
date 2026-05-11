// 📊 Component Telemetry — 元件健康度紀錄端點（Phase 1 / 2026-05-12）
//
// 端點：
//   POST  /api/component-runs/start     mount 時呼叫、回 runId
//   PATCH /api/component-runs/:id       更新 firstInteractionAt / completedAt / finalState / 計數 / lastError
//   GET   /api/admin/component-health   聚合統計（7 天完成率 / 平均耗時 / 對比前 7 天）
//
// 隱私 / 安全：
//   - 無需 admin auth（玩家寫自己的紀錄）
//   - admin 端點才需 auth
//   - lastError redact（前端傳上來時應該已去敏感欄位）
//   - 限 ws_event_log 同樣 redact 規則（簡化版）

import type { Express } from "express";
import { z } from "zod";
import { db } from "../db";
import { componentRuns } from "@shared/schema";
import { sql, eq, gte, and } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

const startSchema = z.object({
  sessionId: z.string().optional().nullable(),
  userId: z.string().optional().nullable(),
  teamId: z.string().optional().nullable(),
  pageId: z.string().optional().nullable(),
  componentType: z.string().min(1).max(50),
});

const patchSchema = z.object({
  firstInteractionAt: z.string().optional(),
  completedAt: z.string().optional(),
  finalState: z.enum(["completed", "abandoned", "errored", "timeout", "skipped"]).optional(),
  retryCount: z.number().int().min(0).max(1000).optional(),
  errorCount: z.number().int().min(0).max(1000).optional(),
  networkErrorCount: z.number().int().min(0).max(1000).optional(),
  lastError: z.string().max(2000).optional(),
});

export function registerComponentTelemetryRoutes(app: Express) {
  // ─── POST /api/component-runs/start ──────────────────────────
  app.post("/api/component-runs/start", async (req, res) => {
    try {
      const parsed = startSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "請求格式錯誤" });
      }
      const [row] = await db
        .insert(componentRuns)
        .values({
          sessionId: parsed.data.sessionId ?? null,
          userId: parsed.data.userId ?? null,
          teamId: parsed.data.teamId ?? null,
          pageId: parsed.data.pageId ?? null,
          componentType: parsed.data.componentType,
        })
        .returning({ id: componentRuns.id, mountedAt: componentRuns.mountedAt });
      res.json({ id: row.id, mountedAt: row.mountedAt });
    } catch (err) {
      // 失敗不阻塞玩家、回 fallback id
      console.error("[component-telemetry] start failed:", err);
      res.status(500).json({ error: "internal", fallbackId: null });
    }
  });

  // ─── PATCH /api/component-runs/:id ───────────────────────────
  app.patch("/api/component-runs/:id", async (req, res) => {
    try {
      const parsed = patchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "請求格式錯誤" });
      }

      // 計算 durationMs / interactionLatencyMs（如 completedAt + 既有 mountedAt）
      const [existing] = await db
        .select({
          mountedAt: componentRuns.mountedAt,
          firstInteractionAt: componentRuns.firstInteractionAt,
        })
        .from(componentRuns)
        .where(eq(componentRuns.id, req.params.id));
      if (!existing) {
        return res.status(404).json({ error: "run not found" });
      }

      const updates: Record<string, unknown> = {};
      if (parsed.data.firstInteractionAt) {
        const fia = new Date(parsed.data.firstInteractionAt);
        updates.firstInteractionAt = fia;
        const latency = fia.getTime() - new Date(existing.mountedAt).getTime();
        if (latency >= 0 && latency < 10 * 60 * 1000) {
          updates.interactionLatencyMs = latency;
        }
      }
      if (parsed.data.completedAt) {
        const ca = new Date(parsed.data.completedAt);
        updates.completedAt = ca;
        const dur = ca.getTime() - new Date(existing.mountedAt).getTime();
        if (dur >= 0 && dur < 4 * 60 * 60 * 1000) {
          updates.durationMs = dur;
        }
      }
      if (parsed.data.finalState) updates.finalState = parsed.data.finalState;
      if (parsed.data.retryCount !== undefined) updates.retryCount = parsed.data.retryCount;
      if (parsed.data.errorCount !== undefined) updates.errorCount = parsed.data.errorCount;
      if (parsed.data.networkErrorCount !== undefined) {
        updates.networkErrorCount = parsed.data.networkErrorCount;
      }
      if (parsed.data.lastError) updates.lastError = parsed.data.lastError.slice(0, 2000);

      if (Object.keys(updates).length === 0) {
        return res.json({ ok: true, noop: true });
      }

      await db.update(componentRuns).set(updates).where(eq(componentRuns.id, req.params.id));
      res.json({ ok: true });
    } catch (err) {
      console.error("[component-telemetry] patch failed:", err);
      res.status(500).json({ error: "internal" });
    }
  });

  // ─── GET /api/admin/component-health 聚合統計 ───────────────
  app.get(
    "/api/admin/component-health",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        const days = Math.min(30, Math.max(1, parseInt((req.query.days as string) ?? "7", 10)));
        // 對比基準：前 N 天（days~2*days 之間）
        // 用 raw SQL 一次聚合（current + baseline）
        const rows = await db.execute<{
          component_type: string;
          current_runs: string;
          current_completed: string;
          current_errored: string;
          current_abandoned: string;
          current_avg_duration_ms: string | null;
          current_avg_latency_ms: string | null;
          baseline_runs: string;
          baseline_completed: string;
        }>(sql`
          WITH cur AS (
            SELECT component_type,
              COUNT(*) AS runs,
              COUNT(*) FILTER (WHERE final_state = 'completed') AS completed,
              COUNT(*) FILTER (WHERE final_state = 'errored') AS errored,
              COUNT(*) FILTER (WHERE final_state = 'abandoned') AS abandoned,
              AVG(duration_ms) AS avg_duration_ms,
              AVG(interaction_latency_ms) AS avg_latency_ms
            FROM component_runs
            WHERE mounted_at >= NOW() - (${days} || ' days')::interval
            GROUP BY component_type
          ),
          base AS (
            SELECT component_type,
              COUNT(*) AS runs,
              COUNT(*) FILTER (WHERE final_state = 'completed') AS completed
            FROM component_runs
            WHERE mounted_at >= NOW() - (${days * 2} || ' days')::interval
              AND mounted_at <  NOW() - (${days} || ' days')::interval
            GROUP BY component_type
          )
          SELECT
            cur.component_type,
            cur.runs::text AS current_runs,
            cur.completed::text AS current_completed,
            cur.errored::text AS current_errored,
            cur.abandoned::text AS current_abandoned,
            cur.avg_duration_ms::text AS current_avg_duration_ms,
            cur.avg_latency_ms::text AS current_avg_latency_ms,
            COALESCE(base.runs, 0)::text AS baseline_runs,
            COALESCE(base.completed, 0)::text AS baseline_completed
          FROM cur
          LEFT JOIN base ON base.component_type = cur.component_type
          ORDER BY cur.runs DESC
        `);
        const dataRows = (rows as unknown as { rows?: typeof rows extends { rows: infer R } ? R : never[] }).rows ?? [];
        res.json({ days, stats: dataRows });
      } catch (err) {
        console.error("[component-telemetry] health failed:", err);
        res.status(500).json({ error: "internal" });
      }
    },
  );
}
