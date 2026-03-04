// 水彈對戰 PK 擂台 — 管理端統計 + 排名管理路由
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { db } from "../db";
import {
  battleResults,
  battlePlayerResults,
  battlePlayerRankings,
  battleSlots,
  battleVenues,
} from "@shared/schema";
import { eq, and, count, sql, gte, desc, like, or, inArray } from "drizzle-orm";
import { getTierFromRating, tierLabels } from "@shared/schema";
import { z } from "zod";

export function registerAdminBattleRoutes(app: Express) {
  // ============================================================================
  // GET /api/admin/battle/stats — 對戰統計概覽
  // ============================================================================
  app.get("/api/admin/battle/stats", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      // 取得場域下所有場地 ID
      const venues = await db
        .select({ id: battleVenues.id })
        .from(battleVenues)
        .where(eq(battleVenues.fieldId, fieldId));
      const venueIds = venues.map((v) => v.id);

      if (venueIds.length === 0) {
        return res.json({
          totalBattles: 0,
          totalPlayers: 0,
          monthBattles: 0,
          avgPlayersPerBattle: 0,
        });
      }

      // 總場次
      const [totalResult] = await db
        .select({ count: count() })
        .from(battleResults)
        .where(inArray(battleResults.venueId, venueIds));

      // 活躍玩家數
      const [playerResult] = await db
        .select({ count: count() })
        .from(battlePlayerRankings)
        .where(eq(battlePlayerRankings.fieldId, fieldId));

      // 本月場次
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [monthResult] = await db
        .select({ count: count() })
        .from(battleResults)
        .where(
          and(
            inArray(battleResults.venueId, venueIds),
            gte(battleResults.createdAt, monthStart),
          ),
        );

      // 平均每場人數
      const totalBattles = totalResult?.count ?? 0;
      let avgPlayers = 0;
      if (totalBattles > 0) {
        const [avgResult] = await db
          .select({
            total: sql<number>`COUNT(*)`,
          })
          .from(battlePlayerResults)
          .innerJoin(battleResults, eq(battlePlayerResults.resultId, battleResults.id))
          .where(inArray(battleResults.venueId, venueIds));
        avgPlayers = Math.round((avgResult?.total ?? 0) / totalBattles);
      }

      res.json({
        totalBattles,
        totalPlayers: playerResult?.count ?? 0,
        monthBattles: monthResult?.count ?? 0,
        avgPlayersPerBattle: avgPlayers,
      });
    } catch (error) {
      res.status(500).json({ error: "取得統計失敗", detail: error instanceof Error ? error.message : String(error) });
    }
  });

  // ============================================================================
  // GET /api/admin/battle/recent-results — 最近對戰結果
  // ============================================================================
  app.get("/api/admin/battle/recent-results", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const results = await db
        .select({
          id: battleResults.id,
          slotId: battleResults.slotId,
          venueId: battleResults.venueId,
          winningTeam: battleResults.winningTeam,
          isDraw: battleResults.isDraw,
          teamScores: battleResults.teamScores,
          durationMinutes: battleResults.durationMinutes,
          createdAt: battleResults.createdAt,
          venueName: battleVenues.name,
        })
        .from(battleResults)
        .innerJoin(battleVenues, eq(battleResults.venueId, battleVenues.id))
        .where(eq(battleVenues.fieldId, fieldId))
        .orderBy(desc(battleResults.createdAt))
        .limit(limit);

      // 附加每場玩家數
      const enriched = await Promise.all(
        results.map(async (r) => {
          const [pc] = await db
            .select({ count: count() })
            .from(battlePlayerResults)
            .where(eq(battlePlayerResults.resultId, r.id));
          return { ...r, playerCount: pc?.count ?? 0 };
        }),
      );

      res.json(enriched);
    } catch {
      res.status(500).json({ error: "取得最近結果失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/battle/rankings — 排名列表（含搜尋）
  // ============================================================================
  app.get("/api/admin/battle/rankings", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const search = (req.query.search as string) || "";

      let query = db
        .select()
        .from(battlePlayerRankings)
        .where(eq(battlePlayerRankings.fieldId, fieldId))
        .orderBy(desc(battlePlayerRankings.rating))
        .limit(limit);

      if (search) {
        // 搜尋 userId（因為排名表只有 userId）
        query = db
          .select()
          .from(battlePlayerRankings)
          .where(
            and(
              eq(battlePlayerRankings.fieldId, fieldId),
              like(battlePlayerRankings.userId, `%${search}%`),
            ),
          )
          .orderBy(desc(battlePlayerRankings.rating))
          .limit(limit);
      }

      const rankings = await query;
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
      res.status(500).json({ error: "取得排名失敗" });
    }
  });

  // ============================================================================
  // PATCH /api/admin/battle/rankings/:id — 手動調整 rating
  // ============================================================================
  const adjustRatingSchema = z.object({
    rating: z.number().int().min(0).max(5000),
    reason: z.string().max(200).optional(),
  });

  app.patch("/api/admin/battle/rankings/:id", requireAdminAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const data = adjustRatingSchema.parse(req.body);

      const [updated] = await db
        .update(battlePlayerRankings)
        .set({
          rating: data.rating,
          tier: getTierFromRating(data.rating),
          updatedAt: new Date(),
        })
        .where(eq(battlePlayerRankings.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "排名紀錄不存在" });
      }

      res.json({
        ...updated,
        tierLabel: tierLabels[updated.tier as keyof typeof tierLabels] ?? updated.tier,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
      }
      res.status(500).json({ error: "調整排名失敗" });
    }
  });

  // ============================================================================
  // GET /api/admin/battle/tier-distribution — 段位分佈
  // ============================================================================
  app.get("/api/admin/battle/tier-distribution", requireAdminAuth, async (req, res) => {
    try {
      const fieldId = req.query.fieldId as string;
      if (!fieldId) {
        return res.status(400).json({ error: "缺少 fieldId 參數" });
      }

      const distribution = await db
        .select({
          tier: battlePlayerRankings.tier,
          count: count(),
        })
        .from(battlePlayerRankings)
        .where(eq(battlePlayerRankings.fieldId, fieldId))
        .groupBy(battlePlayerRankings.tier);

      // 確保所有段位都有資料
      const allTiers = ["bronze", "silver", "gold", "platinum", "diamond", "master"];
      const result = allTiers.map((tier) => ({
        tier,
        tierLabel: tierLabels[tier as keyof typeof tierLabels] ?? tier,
        count: distribution.find((d) => d.tier === tier)?.count ?? 0,
      }));

      res.json(result);
    } catch {
      res.status(500).json({ error: "取得段位分佈失敗" });
    }
  });
}
