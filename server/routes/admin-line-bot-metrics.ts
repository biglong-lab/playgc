// 📊 Admin LINE Bot 使用報表 endpoint（W2 / 2026-05-14）
//
// 端點：
//   GET /api/admin/metrics/line-bot-usage?days=7|30
//
// 統計：
//   - 對話量 + intent 分布
//   - 成功建場次數 / 失敗原因 top
//   - reminder 推送量
//
// 對應計畫：docs/changes/2026-05-14-platform-optimization-comprehensive.md (W2)
// 對應 schema：shared/schema/line-bot-events.ts

import type { Express } from "express";
import { db } from "../db";
import { lineBotEvents } from "@shared/schema/line-bot-events";
import { and, eq, gte, sql, isNotNull } from "drizzle-orm";
import { requireAdminAuth } from "../adminAuth";

export function registerAdminLineBotMetricsRoutes(app: Express) {
  app.get(
    "/api/admin/metrics/line-bot-usage",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });
        const days = Math.min(
          Math.max(parseInt(String(req.query.days ?? "7"), 10) || 7, 1),
          90,
        );
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const isSuperAdmin = req.admin.systemRole === "super_admin";
        const fieldId = req.admin.fieldId;
        const fieldFilter = isSuperAdmin
          ? sql`1=1`
          : eq(lineBotEvents.fieldId, fieldId ?? "__none__");

        // 1. 總事件數 + 對話量（message_received）+ 唯一 user 數
        const [totals] = await db
          .select({
            totalEvents: sql<number>`count(*)::int`,
            messagesReceived: sql<number>`count(*) filter (where ${lineBotEvents.eventType} = 'message_received')::int`,
            uniqueUsers: sql<number>`count(distinct ${lineBotEvents.lineUserId})::int`,
            actionSuccess: sql<number>`count(*) filter (where ${lineBotEvents.eventType} = 'action_success')::int`,
            actionFailed: sql<number>`count(*) filter (where ${lineBotEvents.eventType} = 'action_failed')::int`,
            remindersPushed: sql<number>`count(*) filter (where ${lineBotEvents.eventType} = 'reminder_pushed')::int`,
          })
          .from(lineBotEvents)
          .where(and(gte(lineBotEvents.timestamp, since), fieldFilter));

        // 2. Intent 分布
        const intents = await db
          .select({
            intent: lineBotEvents.intent,
            count: sql<number>`count(*)::int`,
          })
          .from(lineBotEvents)
          .where(
            and(
              gte(lineBotEvents.timestamp, since),
              isNotNull(lineBotEvents.intent),
              fieldFilter,
            ),
          )
          .groupBy(lineBotEvents.intent)
          .orderBy(sql`count(*) desc`);

        // 3. 成功建場次數（intent=intent_create_game + resultingGameId not null）
        const [createGameStats] = await db
          .select({
            totalCreateGameAttempts: sql<number>`count(*) filter (where ${lineBotEvents.intent} = 'intent_create_game')::int`,
            successCreateGame: sql<number>`count(*) filter (where ${lineBotEvents.intent} = 'intent_create_game' and ${lineBotEvents.resultingGameId} is not null)::int`,
          })
          .from(lineBotEvents)
          .where(and(gte(lineBotEvents.timestamp, since), fieldFilter));

        // 4. Top 失敗原因
        const topErrors = await db
          .select({
            errorReason: lineBotEvents.errorReason,
            count: sql<number>`count(*)::int`,
          })
          .from(lineBotEvents)
          .where(
            and(
              gte(lineBotEvents.timestamp, since),
              eq(lineBotEvents.eventType, "action_failed"),
              isNotNull(lineBotEvents.errorReason),
              fieldFilter,
            ),
          )
          .groupBy(lineBotEvents.errorReason)
          .orderBy(sql`count(*) desc`)
          .limit(10);

        const messagesReceived = totals?.messagesReceived ?? 0;
        const createAttempts = createGameStats?.totalCreateGameAttempts ?? 0;
        const createSuccess = createGameStats?.successCreateGame ?? 0;

        res.json({
          windowDays: days,
          fieldId: isSuperAdmin ? "all" : fieldId,
          activity: {
            totalEvents: totals?.totalEvents ?? 0,
            messagesReceived,
            uniqueUsers: totals?.uniqueUsers ?? 0,
            messagesPerUser:
              (totals?.uniqueUsers ?? 0) > 0
                ? Math.round((messagesReceived / totals!.uniqueUsers) * 10) / 10
                : 0,
          },
          createGame: {
            attempts: createAttempts,
            success: createSuccess,
            successRate:
              createAttempts > 0
                ? Math.round((createSuccess / createAttempts) * 100)
                : 0,
          },
          actions: {
            success: totals?.actionSuccess ?? 0,
            failed: totals?.actionFailed ?? 0,
            successRate:
              ((totals?.actionSuccess ?? 0) + (totals?.actionFailed ?? 0)) > 0
                ? Math.round(
                    ((totals?.actionSuccess ?? 0) /
                      ((totals?.actionSuccess ?? 0) +
                        (totals?.actionFailed ?? 0))) *
                      100,
                  )
                : 0,
          },
          remindersPushed: totals?.remindersPushed ?? 0,
          intents,
          topErrors,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("[admin-line-bot-metrics] 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );
}
