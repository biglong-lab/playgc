// 📊 Admin Session Timings — admin SLA 埋點 + 統計 endpoint（W2 / 2026-05-14）
//
// 端點：
//   POST /api/admin/timings/milestone   記錄 funnel milestone（upsert）
//   GET  /api/admin/timings/sla-stats   看 p50/p90/p95 + SLA 達成率
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W2)
// 對應 schema：shared/schema/admin-session-timings.ts

import type { Express } from "express";
import { db } from "../db";
import {
  adminSessionTimings,
  ADMIN_SLA_TARGET_MS,
  ADMIN_SLA_WARNING_MS,
  type AdminTimingMilestone,
} from "@shared/schema/admin-session-timings";
import { and, eq, gte, sql, isNotNull } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";
import { z } from "zod";

const milestoneEnum = z.enum([
  "entered_admin",
  "opened_scenario_picker",
  "selected_scenario",
  "instantiated_game",
  "opened_qr_print",
  "qr_printed",
  "abandoned",
]);

const milestoneBodySchema = z.object({
  funnelId: z.string().min(1).max(100),
  milestone: milestoneEnum,
  scenarioId: z.string().optional(),
  useAi: z.boolean().optional(),
  resultingGameId: z.string().optional(),
});

export function registerAdminTimingsRoutes(app: Express) {
  /**
   * POST /api/admin/timings/milestone
   * 記錄一個 milestone — funnelId 不存在則建新筆、存在則 merge 進 jsonb
   *
   * Body: { funnelId, milestone, scenarioId?, useAi?, resultingGameId? }
   */
  app.post("/api/admin/timings/milestone", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ error: "未認證" });

      const parsed = milestoneBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "參數錯誤", details: parsed.error.issues });
      }
      const { funnelId, milestone, scenarioId, useAi, resultingGameId } = parsed.data;
      const now = new Date();

      // 找 funnel 是否已存在
      const [existing] = await db
        .select()
        .from(adminSessionTimings)
        .where(eq(adminSessionTimings.funnelId, funnelId))
        .limit(1);

      if (!existing) {
        // 新建
        await db.insert(adminSessionTimings).values({
          adminId: req.admin.id,
          fieldId: req.admin.fieldId ?? null,
          funnelId,
          milestones: { [milestone]: now.toISOString() },
          startedAt: now,
          scenarioId: scenarioId ?? null,
          useAi: useAi === undefined ? null : useAi ? "true" : "false",
          resultingGameId: resultingGameId ?? null,
        });
      } else {
        // 更新 milestone（merge jsonb）+ 結算 completedAt / abandonedAt
        const updatedMilestones = {
          ...(existing.milestones as Record<string, string>),
          [milestone]: now.toISOString(),
        };
        const isComplete = milestone === "qr_printed";
        const isAbandon = milestone === "abandoned";
        const startedAt = existing.startedAt ?? now;
        const totalDurationMs = isComplete ? now.getTime() - startedAt.getTime() : null;

        await db
          .update(adminSessionTimings)
          .set({
            milestones: updatedMilestones,
            completedAt: isComplete ? now : existing.completedAt,
            abandonedAt: isAbandon ? now : existing.abandonedAt,
            totalDurationMs: totalDurationMs ?? existing.totalDurationMs,
            scenarioId: scenarioId ?? existing.scenarioId,
            useAi:
              useAi === undefined
                ? existing.useAi
                : useAi
                ? "true"
                : "false",
            resultingGameId: resultingGameId ?? existing.resultingGameId,
          })
          .where(eq(adminSessionTimings.funnelId, funnelId));
      }

      res.json({ ok: true, funnelId, milestone, recordedAt: now.toISOString() });
    } catch (err) {
      console.error("[admin-timings/milestone] 失敗:", err);
      res.status(500).json({ error: "記錄失敗" });
    }
  });

  /**
   * GET /api/admin/timings/sla-stats?days=7|30
   * 統計：總 funnel 數、完成數、放棄數、p50/p90/p95、SLA 達成率
   */
  app.get("/api/admin/timings/sla-stats", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) return res.status(401).json({ error: "未認證" });
      const days = Math.min(
        Math.max(parseInt(String(req.query.days ?? "30"), 10) || 30, 1),
        90,
      );
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const isSuperAdmin = req.admin.systemRole === "super_admin";
      const fieldId = req.admin.fieldId;

      const fieldFilter = isSuperAdmin
        ? sql`1=1`
        : eq(adminSessionTimings.fieldId, fieldId ?? "__none__");

      // 1. 總 funnel 統計
      const [totals] = await db
        .select({
          total: sql<number>`count(*)::int`,
          completed: sql<number>`count(*) filter (where ${adminSessionTimings.completedAt} is not null)::int`,
          abandoned: sql<number>`count(*) filter (where ${adminSessionTimings.abandonedAt} is not null)::int`,
        })
        .from(adminSessionTimings)
        .where(and(gte(adminSessionTimings.startedAt, since), fieldFilter));

      // 2. duration percentiles（只看 completed）
      const [durations] = await db
        .select({
          p50: sql<number>`percentile_cont(0.5) within group (order by total_duration_ms)::int`,
          p90: sql<number>`percentile_cont(0.9) within group (order by total_duration_ms)::int`,
          p95: sql<number>`percentile_cont(0.95) within group (order by total_duration_ms)::int`,
          slaHits: sql<number>`count(*) filter (where total_duration_ms <= ${ADMIN_SLA_TARGET_MS})::int`,
          warningHits: sql<number>`count(*) filter (where total_duration_ms > ${ADMIN_SLA_TARGET_MS} and total_duration_ms <= ${ADMIN_SLA_WARNING_MS})::int`,
          criticalHits: sql<number>`count(*) filter (where total_duration_ms > ${ADMIN_SLA_WARNING_MS})::int`,
        })
        .from(adminSessionTimings)
        .where(
          and(
            gte(adminSessionTimings.startedAt, since),
            isNotNull(adminSessionTimings.totalDurationMs),
            fieldFilter,
          ),
        );

      // 3. AI 採用率（completed funnels 中、useAi=true 的比例）
      const [aiStats] = await db
        .select({
          totalCompleted: sql<number>`count(*) filter (where ${adminSessionTimings.completedAt} is not null)::int`,
          aiUsed: sql<number>`count(*) filter (where ${adminSessionTimings.completedAt} is not null and ${adminSessionTimings.useAi} = 'true')::int`,
        })
        .from(adminSessionTimings)
        .where(and(gte(adminSessionTimings.startedAt, since), fieldFilter));

      const total = totals?.total ?? 0;
      const completed = totals?.completed ?? 0;
      const slaHits = durations?.slaHits ?? 0;

      res.json({
        windowDays: days,
        fieldId: isSuperAdmin ? "all" : fieldId,
        funnel: {
          total,
          completed,
          abandoned: totals?.abandoned ?? 0,
          completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        },
        duration: {
          p50Ms: durations?.p50 ?? null,
          p90Ms: durations?.p90 ?? null,
          p95Ms: durations?.p95 ?? null,
        },
        sla: {
          targetMs: ADMIN_SLA_TARGET_MS,
          warningMs: ADMIN_SLA_WARNING_MS,
          hits: slaHits,
          warnings: durations?.warningHits ?? 0,
          critical: durations?.criticalHits ?? 0,
          attainmentRate:
            completed > 0 ? Math.round((slaHits / completed) * 100) : 0,
        },
        aiAdoption: {
          totalCompleted: aiStats?.totalCompleted ?? 0,
          aiUsed: aiStats?.aiUsed ?? 0,
          rate:
            (aiStats?.totalCompleted ?? 0) > 0
              ? Math.round((aiStats!.aiUsed / aiStats!.totalCompleted) * 100)
              : 0,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[admin-timings/sla-stats] 失敗:", err);
      res.status(500).json({ error: "查詢失敗" });
    }
  });
}
