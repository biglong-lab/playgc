// 📊 Admin Metrics — 完成率歸因 endpoint（2026-05-14 W1）
//
// 目的：
//   業主活動 7 天完成率 9.5% / 放棄率 47.5% — 我們有 component_runs 資料但缺「分群歸因」
//   本檔提供 admin 一個 endpoint 看「為什麼放棄、卡哪步」
//
// 端點：
//   GET /api/admin/metrics/completion-attribution
//     ?fieldId=...&days=7|30
//
// 不需新表 — 撈既有 component_runs。
// 參考：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W1)

import type { Express } from "express";
import { db } from "../db";
import { componentRuns } from "@shared/schema/observability";
import { games, gameSessions } from "@shared/schema";
import { and, eq, gte, sql, isNotNull, inArray } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

export function registerAdminMetricsCompletionRoutes(app: Express) {
  app.get(
    "/api/admin/metrics/completion-attribution",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const isSuperAdmin = req.admin.systemRole === "super_admin";
        const adminFieldId = req.admin.fieldId;
        const days = Math.min(Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1), 90);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const queryFieldId = typeof req.query.fieldId === "string" ? req.query.fieldId : undefined;

        // 場域過濾：super_admin 可指定任何 fieldId（不指定 = 全平台）；一般 admin 只能看自己
        const effectiveFieldId = isSuperAdmin ? queryFieldId : adminFieldId;

        // 撈 30/7 天內的 sessionIds（依場域過濾）
        let sessionIdSubquery: string[] | undefined;
        if (effectiveFieldId) {
          const gameIds = await db
            .select({ id: games.id })
            .from(games)
            .where(eq(games.fieldId, effectiveFieldId));
          const gameIdList = gameIds.map((g) => g.id);
          if (gameIdList.length === 0) {
            return res.json({
              windowDays: days,
              fieldId: effectiveFieldId,
              totalRuns: 0,
              byFinalState: [],
              byComponentType: [],
              byPageId: [],
              durationDistribution: { p50: null, p90: null, p95: null },
              topErrors: [],
              timestamp: new Date().toISOString(),
            });
          }
          const sessions = await db
            .select({ id: gameSessions.id })
            .from(gameSessions)
            .where(inArray(gameSessions.gameId, gameIdList));
          sessionIdSubquery = sessions.map((s) => s.id);
        }

        // 1. 依 finalState 分群（completed / abandoned / errored / timeout / skipped）
        const byFinalState = await db
          .select({
            finalState: componentRuns.finalState,
            count: sql<number>`count(*)::int`,
          })
          .from(componentRuns)
          .where(
            and(
              gte(componentRuns.mountedAt, since),
              sessionIdSubquery
                ? inArray(componentRuns.sessionId, sessionIdSubquery)
                : sql`1=1`,
            ),
          )
          .groupBy(componentRuns.finalState);

        const totalRuns = byFinalState.reduce((sum, r) => sum + r.count, 0);

        // 2. 依 componentType 分群 — 找「哪種元件放棄最多」
        const byComponentType = await db
          .select({
            componentType: componentRuns.componentType,
            finalState: componentRuns.finalState,
            count: sql<number>`count(*)::int`,
          })
          .from(componentRuns)
          .where(
            and(
              gte(componentRuns.mountedAt, since),
              sessionIdSubquery
                ? inArray(componentRuns.sessionId, sessionIdSubquery)
                : sql`1=1`,
            ),
          )
          .groupBy(componentRuns.componentType, componentRuns.finalState);

        // 3. 依 pageId 分群 — 找「哪頁卡最多」
        const byPageId = await db
          .select({
            pageId: componentRuns.pageId,
            finalState: componentRuns.finalState,
            count: sql<number>`count(*)::int`,
          })
          .from(componentRuns)
          .where(
            and(
              gte(componentRuns.mountedAt, since),
              isNotNull(componentRuns.pageId),
              sessionIdSubquery
                ? inArray(componentRuns.sessionId, sessionIdSubquery)
                : sql`1=1`,
            ),
          )
          .groupBy(componentRuns.pageId, componentRuns.finalState);

        // 4. 完成時間 distribution（只看 completed）
        const durationStats = await db
          .select({
            p50: sql<number>`percentile_cont(0.5) within group (order by duration_ms)::int`,
            p90: sql<number>`percentile_cont(0.9) within group (order by duration_ms)::int`,
            p95: sql<number>`percentile_cont(0.95) within group (order by duration_ms)::int`,
          })
          .from(componentRuns)
          .where(
            and(
              gte(componentRuns.mountedAt, since),
              eq(componentRuns.finalState, "completed"),
              isNotNull(componentRuns.durationMs),
              sessionIdSubquery
                ? inArray(componentRuns.sessionId, sessionIdSubquery)
                : sql`1=1`,
            ),
          );

        // 5. Top 錯誤訊息（前 10 個）
        const topErrors = await db
          .select({
            lastError: componentRuns.lastError,
            componentType: componentRuns.componentType,
            count: sql<number>`count(*)::int`,
          })
          .from(componentRuns)
          .where(
            and(
              gte(componentRuns.mountedAt, since),
              isNotNull(componentRuns.lastError),
              sessionIdSubquery
                ? inArray(componentRuns.sessionId, sessionIdSubquery)
                : sql`1=1`,
            ),
          )
          .groupBy(componentRuns.lastError, componentRuns.componentType)
          .orderBy(sql`count(*) desc`)
          .limit(10);

        res.json({
          windowDays: days,
          fieldId: effectiveFieldId ?? "all",
          totalRuns,
          byFinalState,
          byComponentType,
          byPageId,
          durationDistribution: durationStats[0] ?? { p50: null, p90: null, p95: null },
          topErrors,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-metrics-completion] 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );
}
