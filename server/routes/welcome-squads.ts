// 玩家端：歡迎隊伍 — Phase 12.3
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §14
//
// 端點：
//   GET /api/fields/:fieldId/welcome-squads      — 取得該場域的歡迎隊伍（公開）
//   POST /api/me/welcome-squads/dismiss/:fieldId — 玩家「不再顯示」（記在 user 端）
//
// 觸發時機（前端）：
//   - 玩家第一次進入新場域（FieldThemeProvider 觸發）
//   - localStorage 標記已看過 → 24 小時內不再顯示
//
import type { Express } from "express";
import { db } from "../db";
import {
  fieldEngagementSettings,
  squadStats,
  battleClans,
} from "@shared/schema";
import { eq, desc, inArray } from "drizzle-orm";

export function registerWelcomeSquadsRoutes(app: Express) {
  // ============================================================================
  // GET /api/fields/:fieldId/welcome-squads — 玩家端取歡迎隊伍清單（公開）
  // ============================================================================
  app.get("/api/fields/:fieldId/welcome-squads", async (req, res) => {
    try {
      const fieldId = req.params.fieldId;

      // 1. 取場域設定
      const [settings] = await db
        .select()
        .from(fieldEngagementSettings)
        .where(eq(fieldEngagementSettings.fieldId, fieldId));

      // 沒設定 → 用預設（auto top 5 by total_games）
      const config = settings ?? {
        welcomeMode: "auto" as const,
        welcomeAutoTopN: 5,
        welcomeAutoCriteria: "total_games" as const,
        welcomeManualIds: [] as string[],
      };

      // 2. 取候選隊伍（top 50）
      const allSquads = await db
        .select()
        .from(squadStats)
        .orderBy(desc(squadStats.totalGames))
        .limit(50);

      // 3. 用 selectWelcomeSquads 計算
      const { selectWelcomeSquads } = await import(
        "../services/engagement-calculator"
      );

      const selected = selectWelcomeSquads(
        allSquads.map((s) => ({
          squadId: s.squadId,
          totalGames: s.totalGames,
          totalWins: s.totalWins,
          totalLosses: s.totalLosses,
          recruitsCount: s.recruitsCount,
          fieldsPlayed: (s.fieldsPlayed as string[]) ?? [],
          lastActiveAt: s.lastActiveAt,
          rating: undefined,
        })),
        {
          mode: config.welcomeMode as "auto" | "manual" | "hybrid",
          autoTopN: config.welcomeAutoTopN ?? 5,
          autoCriteria: (config.welcomeAutoCriteria ?? "total_games") as
            | "total_games"
            | "rating"
            | "recent_active",
          manualIds: (config.welcomeManualIds as string[]) ?? [],
        },
      );

      if (selected.length === 0) {
        return res.json({
          fieldId,
          squads: [],
          message: "目前沒有推薦的歡迎隊伍",
        });
      }

      // 4. Join 隊伍名稱
      const squadIds = selected.map((s) => s.squadId);
      const clans = await db
        .select({
          id: battleClans.id,
          name: battleClans.name,
          tag: battleClans.tag,
          logoUrl: battleClans.logoUrl,
        })
        .from(battleClans)
        .where(inArray(battleClans.id, squadIds));
      const clanMap = new Map(clans.map((c) => [c.id, c]));

      const manualSet = new Set((config.welcomeManualIds as string[]) ?? []);
      const squadsWithName = selected.map((s) => {
        const clan = clanMap.get(s.squadId);
        const winRate =
          s.totalGames > 0
            ? Math.round(
                (s.totalWins /
                  Math.max(1, s.totalWins + s.totalLosses)) *
                  100,
              )
            : 0;
        return {
          squadId: s.squadId,
          squadName: clan?.name ?? "未知隊伍",
          squadTag: clan?.tag ?? null,
          logoUrl: clan?.logoUrl ?? null,
          totalGames: s.totalGames,
          recruitsCount: s.recruitsCount,
          fieldsPlayed: s.fieldsPlayed?.length ?? 0,
          winRate,
          isManual: manualSet.has(s.squadId),
        };
      });

      res.json({
        fieldId,
        squads: squadsWithName,
      });
    } catch (error) {
      console.error("[welcome-squads] GET 失敗:", error);
      res.status(500).json({ error: "取得歡迎隊伍失敗" });
    }
  });
}
