// 📊 Admin Pilot Health — 客戶健康度儀表板雛形（W17 D4）
//
// 端點：
//   GET /api/admin/pilot/health     回傳 pilot 健康度數據
//
// 用途（W17 D4 雛形版本）：
//   - admin 一個 endpoint 看「平台運作狀態」
//   - W20 觀測週會包成完整儀表板 UI
//
// 範圍：
//   - 過去 30 天 host sessions（active / completed）
//   - distinct scenarios used / fields used
//   - 平台服務 configuration status（LINE / NLU / cron / webhook）
//   - 不暴露 secrets

import type { Express } from "express";
import { db } from "../db";
import { games, gameSessions, fields } from "@shared/schema";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { requireAdminAuth, requirePermission } from "../adminAuth";

export function registerAdminPilotHealthRoutes(app: Express) {
  /**
   * GET /api/admin/pilot/health
   * Admin 看 pilot 健康度（活動數 / 場域 / 服務狀態）
   *
   * 場域過濾：
   *   - super_admin：看全平台
   *   - 其他：只看自己場域
   */
  app.get(
    "/api/admin/pilot/health",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ error: "未認證" });

        const isSuperAdmin = req.admin.systemRole === "super_admin";
        const fieldId = req.admin.fieldId;
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const now = new Date();

        // 1. Active host sessions（status='playing' + token 未過期）
        const activeRows = await db
          .select({ session: gameSessions, game: games })
          .from(gameSessions)
          .innerJoin(games, eq(games.id, gameSessions.gameId))
          .where(
            and(
              eq(gameSessions.hostMode, true),
              eq(gameSessions.status, "playing"),
              gte(gameSessions.hostTokenExpiresAt, now),
            ),
          );
        const activeSessions = isSuperAdmin
          ? activeRows
          : activeRows.filter((r) => r.game.fieldId === fieldId);

        // 2. Completed sessions（最近 30 天）
        const completedRows = await db
          .select({ session: gameSessions, game: games })
          .from(gameSessions)
          .innerJoin(games, eq(games.id, gameSessions.gameId))
          .where(
            and(
              eq(gameSessions.hostMode, true),
              eq(gameSessions.status, "completed"),
              gte(gameSessions.completedAt, thirtyDaysAgo),
            ),
          );
        const completedSessions = isSuperAdmin
          ? completedRows
          : completedRows.filter((r) => r.game.fieldId === fieldId);

        // 3. Distinct scenarios used（從 description）
        const allRecentGames = isSuperAdmin
          ? [...activeSessions, ...completedSessions]
          : [...activeSessions, ...completedSessions];

        const scenarioIds = new Set<string>();
        for (const r of allRecentGames) {
          const match = r.game.description?.match(/\[scenario:([^\]]+)\]/);
          if (match) scenarioIds.add(match[1]);
        }

        // 4. Distinct fields（super_admin only）
        let fieldsCount = 1;
        if (isSuperAdmin) {
          const allFields = await db.select({ id: fields.id }).from(fields);
          fieldsCount = allFields.length;
        }

        // 5. Service configuration status（不暴露 secrets）
        const serviceStatus = {
          lineBot: !!(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN),
          lineNlu: !!process.env.OPENROUTER_API_KEY,
          lineAdmin: !!process.env.LINE_ADMIN_USER_IDS,
          cronEnabled: !!process.env.CRON_SECRET,
          webhookDispatch: !!process.env.API_KEY_DEFAULT_FOR_WEBHOOKS,
          payment: !!(
            process.env.RECUR_TW_API_KEY ||
            process.env.STRIPE_SECRET_KEY
          ),
          email: !!process.env.RESEND_API_KEY,
          ai: !!process.env.OPENROUTER_API_KEY,
        };

        // 6. 計算「轉換率」雛形（completed / total in 30d）
        const totalSessions30d = activeSessions.length + completedSessions.length;
        const completionRate =
          totalSessions30d > 0
            ? Math.round((completedSessions.length / totalSessions30d) * 100)
            : 0;

        res.json({
          windowDays: 30,
          timestamp: new Date().toISOString(),
          isSuperAdmin,
          activity: {
            activeSessions: activeSessions.length,
            completedSessions30d: completedSessions.length,
            totalSessions30d,
            completionRate,
          },
          coverage: {
            distinctScenarios: scenarioIds.size,
            scenarioIds: Array.from(scenarioIds),
            fieldsCount,
          },
          serviceStatus,
        });
      } catch (err) {
        console.error("[admin-pilot-health] 失敗:", err);
        res.status(500).json({ error: "查詢失敗" });
      }
    },
  );
}
