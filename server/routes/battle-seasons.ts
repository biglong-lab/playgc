// 水彈對戰 PK 擂台 — 玩家端賽季路由
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import {
  getActiveSeason,
  getSeasonRankings,
  getPlayerSeasonHistory,
  getSeason,
} from "../storage/battle-storage-seasons";
import type { AuthenticatedRequest } from "./types";
import { tierLabels } from "@shared/schema";

export function registerBattleSeasonRoutes(app: Express) {
  // ============================================================================
  // GET /api/battle/season/current — 當前活躍賽季
  // ============================================================================
  app.get("/api/battle/season/current", async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const season = await getActiveSeason(fieldId);
      if (!season) {
        return res.json(null);
      }

      res.json(season);
    } catch {
      res.status(500).json({ error: "取得當前賽季失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/season/:id/rankings — 賽季排名
  // ============================================================================
  app.get("/api/battle/season/:id/rankings", async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const rankings = await getSeasonRankings(req.params.id, limit);

      const enriched = rankings.map((r) => ({
        ...r,
        tierLabel: tierLabels[r.finalTier as keyof typeof tierLabels] ?? r.finalTier,
      }));

      res.json(enriched);
    } catch {
      res.status(500).json({ error: "取得賽季排名失敗" });
    }
  });

  // ============================================================================
  // GET /api/battle/my/season-history — 我的賽季歷史
  // ============================================================================
  app.get(
    "/api/battle/my/season-history",
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

        const history = await getPlayerSeasonHistory(req.user.dbUser.id, fieldId);

        const enriched = history.map((h) => ({
          ...h,
          tierLabel: tierLabels[h.finalTier as keyof typeof tierLabels] ?? h.finalTier,
        }));

        res.json(enriched);
      } catch {
        res.status(500).json({ error: "取得賽季歷史失敗" });
      }
    },
  );
}
