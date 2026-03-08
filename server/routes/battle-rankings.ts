// 水彈對戰 PK 擂台 — 排名路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { battleStorageMethods, getRankingsByFieldWithNames, getPlayerHistoryWithDetails } from "../storage/battle-storage";
import type { AuthenticatedRequest } from "./types";
import { tierLabels, getTierFromRating } from "@shared/schema";
import { buildDisplayName } from "../utils/display-name";

export function registerBattleRankingRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/rankings — 場域排行榜
  // ============================================================================
  app.get("/api/battle/rankings", async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const rows = await getRankingsByFieldWithNames(fieldId, limit);

      const enriched = rows.map((row, idx) => ({
        ...row.ranking,
        rank: idx + 1,
        displayName: buildDisplayName(row.firstName, row.lastName, row.ranking.userId),
        tierLabel: tierLabels[row.ranking.tier as keyof typeof tierLabels] ?? row.ranking.tier,
        winRate: row.ranking.totalBattles > 0
          ? Math.round((row.ranking.wins / row.ranking.totalBattles) * 100)
          : 0,
      }));

      res.json(enriched);
    } catch {
      res.status(500).json({ error: "取得排行榜失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/rankings/me — 我的排名
  // ============================================================================
  app.get(
    "/api/battle/rankings/me",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }

        const fieldId = req.query.fieldId as string;
        if (!fieldId) {
          return res.status(400).json({ error: "缺少 fieldId 參數" });
        }

        const ranking = await battleStorageMethods.getPlayerRanking(req.user.dbUser.id, fieldId);
        const dbUser = req.user.dbUser;
        const displayName = buildDisplayName(
          dbUser.firstName ?? null,
          dbUser.lastName ?? null,
          dbUser.id,
        );

        if (!ranking) {
          return res.json({
            rating: 1000,
            tier: "platinum",
            tierLabel: tierLabels.platinum,
            totalBattles: 0,
            wins: 0,
            losses: 0,
            draws: 0,
            winRate: 0,
            winStreak: 0,
            bestStreak: 0,
            mvpCount: 0,
            displayName,
          });
        }

        res.json({
          ...ranking,
          displayName,
          tierLabel: tierLabels[ranking.tier as keyof typeof tierLabels] ?? ranking.tier,
          winRate: ranking.totalBattles > 0
            ? Math.round((ranking.wins / ranking.totalBattles) * 100)
            : 0,
        });
      } catch {
        res.status(500).json({ error: "取得排名失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/my/history — 我的對戰歷史
  // ============================================================================
  app.get(
    "/api/battle/my/history",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        if (!req.user) {
          return res.status(401).json({ error: "未認證" });
        }

        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const rows = await getPlayerHistoryWithDetails(req.user.dbUser.id, limit);

        const enriched = rows.map((row) => ({
          ...row.playerResult,
          slotDate: row.slotDate,
          startTime: row.startTime,
          venueName: row.venueName,
        }));

        res.json(enriched);
      } catch {
        res.status(500).json({ error: "取得對戰歷史失敗" });
      }
    },
  );
}
