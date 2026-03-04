// 水彈對戰 PK 擂台 — 排名路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import { battleStorageMethods } from "../storage/battle-storage";
import type { AuthenticatedRequest } from "./types";
import { tierLabels, getTierFromRating } from "@shared/schema";

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
      const rankings = await battleStorageMethods.getRankingsByField(fieldId, limit);

      // 附加段位中文
      const enriched = rankings.map((r, idx) => ({
        ...r,
        rank: idx + 1,
        tierLabel: tierLabels[r.tier as keyof typeof tierLabels] ?? r.tier,
        winRate: r.totalBattles > 0
          ? Math.round((r.wins / r.totalBattles) * 100)
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

        if (!ranking) {
          // 尚未有排名紀錄，回傳預設值
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
          });
        }

        res.json({
          ...ranking,
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
        const history = await battleStorageMethods.getPlayerHistory(req.user.dbUser.id, limit);
        res.json(history);
      } catch {
        res.status(500).json({ error: "取得對戰歷史失敗" });
      }
    },
  );
}
