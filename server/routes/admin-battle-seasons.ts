// 水彈對戰 PK 擂台 — 管理端賽季路由
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import {
  createSeason,
  getActiveSeason,
  getSeasonsByField,
  endSeason,
  snapshotSeasonRankings,
  resetFieldRankings,
  getSeasonRankings,
  getSeason,
} from "../storage/battle-storage-seasons";
import { createSeasonSchema } from "@shared/schema";
import { z } from "zod";

export function registerAdminBattleSeasonRoutes(app: Express) {
  // ============================================================================
  // POST /api/admin/battle/seasons — 建立新賽季
  // ============================================================================
  app.post("/api/admin/battle/seasons", requireAdminAuth, async (req, res) => {
    try {
      if (!req.admin) {
        return res.status(401).json({ error: "未認證" });
      }

      const fieldId = req.body.fieldId || req.admin.fieldId;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId" });
      }

      // 檢查是否有活躍賽季
      const active = await getActiveSeason(fieldId);
      if (active) {
        return res.status(409).json({
          error: "該場域已有活躍賽季，請先結束目前賽季",
          activeSeason: active,
        });
      }

      const data = createSeasonSchema.parse(req.body);

      // 計算賽季編號
      const existingSeasons = await getSeasonsByField(fieldId);
      const nextNumber = existingSeasons.length > 0
        ? Math.max(...existingSeasons.map((s) => s.seasonNumber)) + 1
        : 1;

      const season = await createSeason({
        fieldId,
        seasonNumber: nextNumber,
        name: data.name,
        startDate: new Date(data.startDate),
        resetRatingTo: data.resetRatingTo,
        rewards: data.rewards,
      });

      res.status(201).json(season);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "建立賽季失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/battle/seasons — 賽季列表
  // ============================================================================
  app.get("/api/admin/battle/seasons", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const seasons = await getSeasonsByField(fieldId);
      res.json(seasons);
    } catch {
      res.status(500).json({ error: "取得賽季列表失敗" });
    }
  });

  // ============================================================================
  // POST /api/admin/battle/seasons/:id/end — 結束賽季
  // ============================================================================
  app.post("/api/admin/battle/seasons/:id/end", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;

      const season = await getSeason(id);
      if (!season) {
        return res.status(404).json({ error: "賽季不存在" });
      }
      if (season.status !== "active") {
        return res.status(400).json({ error: "只能結束活躍的賽季" });
      }

      // 1. 快照排名
      const snapshots = await snapshotSeasonRankings(id, season.fieldId);

      // 2. 結束賽季
      const ended = await endSeason(id);

      // 3. 重置排名
      await resetFieldRankings(season.fieldId, season.resetRatingTo);

      res.json({
        season: ended,
        snapshotCount: snapshots.length,
        message: `賽季已結束，${snapshots.length} 位玩家排名已快照，rating 已重置為 ${season.resetRatingTo}`,
      });
    } catch {
      res.status(500).json({ error: "結束賽季失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/battle/seasons/:id/rankings — 賽季排名
  // ============================================================================
  app.get("/api/admin/battle/seasons/:id/rankings", requireAdminAuth, async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const rankings = await getSeasonRankings(req.params.id, limit);
      res.json(rankings);
    } catch {
      res.status(500).json({ error: "取得賽季排名失敗" });
    }
  });
}
