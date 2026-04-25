// Squad 系統 — 戰績紀錄路由（跨遊戲統一格式）
//
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §10 §20.4 §22.2
//
// 設計原則：
//   1. 遊戲端只回報「事實」（result + performance），不算分
//   2. 平台後端統一計算 ELO + bonus + 體驗點數
//   3. 同步寫入：squad_match_records + squad_ratings + squad_stats
//
import type { Express } from "express";
import { db } from "../db";
import {
  squadMatchRecords,
  squadRatings,
  squadStats,
  insertSquadMatchRecordSchema,
  type SquadGameType,
} from "@shared/schema";
import { eq, and, sql, desc } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";

// ============================================================================
// 計分公式 — 從 services/squad-rating-calc.ts import（純函式，方便測試）
// ============================================================================
import { calcRewards, deriveTier as _deriveTier } from "../services/squad-rating-calc";
export { calcRewards } from "../services/squad-rating-calc";

// ============================================================================
// API endpoints
// ============================================================================

const reportRecordSchema = z.object({
  squadId: z.string().min(1),
  squadType: z.enum(["team", "clan", "premade_group", "squad"]),
  gameType: z.string().min(1),
  scoringMode: z.enum(["pvp", "pve", "experience", "coop", "personal"]),
  fieldId: z.string().min(1),
  result: z.enum(["win", "loss", "draw", "completed", "failed", "participated", "achieved"]),
  performance: z.record(z.string(), z.unknown()).default({}),
  durationSec: z.number().int().min(0),
  gameId: z.string().optional(),
  slotId: z.string().optional(),
  matchId: z.string().optional(),
  sessionId: z.string().optional(),
  opponentSquadId: z.string().optional(),
});

export function registerSquadRecordsRoutes(app: Express) {
  /**
   * POST /api/squads/records — 回報一場戰績
   *
   * 由各遊戲類型 session 完成時呼叫（自動 hook）
   * 自動：寫入 records、更新 ratings、更新 stats
   */
  app.post(
    "/api/squads/records",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const parsed = reportRecordSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.errors[0]?.message || "驗證失敗",
          });
        }
        const data = parsed.data;

        // 1. 取得目前 rating
        const myRating = await getOrCreateRating(data.squadId, data.squadType, data.gameType);

        // 2. 取得對手 rating（如果 PvP）
        let opponentRating = 1200;
        if (data.opponentSquadId && data.scoringMode === "pvp") {
          const oppRating = await getOrCreateRating(data.opponentSquadId, data.squadType, data.gameType);
          opponentRating = oppRating.rating;
        }

        // 3. 取得 stats（用於 totalGames 算 K 值 + 場域檢查）
        const myStats = await getOrCreateStats(data.squadId, data.squadType);
        const fieldsPlayed = (myStats.fieldsPlayed as string[]) ?? [];
        const isFirstVisit = !fieldsPlayed.includes(data.fieldId);
        const isCrossField = !isFirstVisit && fieldsPlayed.length > 0 && fieldsPlayed[0] !== data.fieldId;

        // 4. 計算獎勵
        const calc = calcRewards({
          myRating: myRating.rating,
          opponentRating,
          result: data.result,
          performance: data.performance,
          totalGames: myRating.gamesPlayed,
          isCrossField,
          isFirstVisit,
          scoringMode: data.scoringMode,
        });

        // 5. 寫入戰績紀錄
        const [record] = await db
          .insert(squadMatchRecords)
          .values({
            squadId: data.squadId,
            squadType: data.squadType,
            gameType: data.gameType,
            gameId: data.gameId,
            slotId: data.slotId,
            matchId: data.matchId,
            sessionId: data.sessionId,
            fieldId: data.fieldId,
            result: data.result,
            ratingBefore: myRating.rating,
            ratingAfter: myRating.rating + calc.ratingChange,
            ratingChange: calc.ratingChange,
            expPoints: calc.expPoints,
            gameCountMultiplier: calc.gameCountMultiplier,
            performance: data.performance,
            isCrossField,
            isFirstVisit,
            durationSec: data.durationSec,
          })
          .returning();

        // 6. 更新 squad_ratings
        const isWin = data.result === "win";
        const isLoss = data.result === "loss";
        const isDraw = data.result === "draw";
        await db
          .update(squadRatings)
          .set({
            rating: myRating.rating + calc.ratingChange,
            gamesPlayed: sql`${squadRatings.gamesPlayed} + 1`,
            wins: isWin ? sql`${squadRatings.wins} + 1` : squadRatings.wins,
            losses: isLoss ? sql`${squadRatings.losses} + 1` : squadRatings.losses,
            draws: isDraw ? sql`${squadRatings.draws} + 1` : squadRatings.draws,
            winStreak: isWin
              ? sql`${squadRatings.winStreak} + 1`
              : 0,
            peakRating: sql`GREATEST(${squadRatings.peakRating}, ${myRating.rating + calc.ratingChange})`,
            tier: deriveTier(myRating.rating + calc.ratingChange),
            lastPlayedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(squadRatings.squadId, data.squadId),
              eq(squadRatings.gameType, data.gameType),
            ),
          );

        // 7. 更新 squad_stats
        const newFieldsPlayed = isFirstVisit
          ? [...fieldsPlayed, data.fieldId]
          : fieldsPlayed;

        await db
          .update(squadStats)
          .set({
            totalGames: sql`${squadStats.totalGames} + ${calc.gameCountMultiplier / 100.0}`,
            totalGamesRaw: sql`${squadStats.totalGamesRaw} + 1`,
            totalWins: isWin ? sql`${squadStats.totalWins} + 1` : squadStats.totalWins,
            totalLosses: isLoss ? sql`${squadStats.totalLosses} + 1` : squadStats.totalLosses,
            totalDraws: isDraw ? sql`${squadStats.totalDraws} + 1` : squadStats.totalDraws,
            totalExpPoints: sql`${squadStats.totalExpPoints} + ${calc.expPoints}`,
            fieldsPlayed: newFieldsPlayed,
            monthlyGames: sql`${squadStats.monthlyGames} + 1`,
            lastActiveAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(squadStats.squadId, data.squadId));

        res.status(201).json({
          success: true,
          record,
          calc,
        });
      } catch (error) {
        console.error("[squad-records] POST 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "寫入戰績失敗",
        });
      }
    },
  );

  /**
   * GET /api/squads/:squadId/records — 取得隊伍戰績清單
   */
  app.get(
    "/api/squads/:squadId/records",
    async (req, res) => {
      try {
        const squadId = req.params.squadId;
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

        const records = await db
          .select()
          .from(squadMatchRecords)
          .where(eq(squadMatchRecords.squadId, squadId))
          .orderBy(desc(squadMatchRecords.playedAt))
          .limit(limit);

        res.json(records);
      } catch (error) {
        console.error("[squad-records] GET 失敗:", error);
        res.status(500).json({ error: "取得戰績失敗" });
      }
    },
  );

  /**
   * GET /api/squads/:squadId/stats — 取得隊伍聚合統計
   */
  app.get("/api/squads/:squadId/stats", async (req, res) => {
    try {
      const squadId = req.params.squadId;
      const stats = await getOrCreateStats(squadId, "squad");
      const ratings = await db
        .select()
        .from(squadRatings)
        .where(eq(squadRatings.squadId, squadId));
      res.json({ stats, ratings });
    } catch (error) {
      console.error("[squad-records] stats 失敗:", error);
      res.status(500).json({ error: "取得統計失敗" });
    }
  });
}

// ============================================================================
// Helpers
// ============================================================================

async function getOrCreateRating(squadId: string, squadType: string, gameType: string) {
  const [existing] = await db
    .select()
    .from(squadRatings)
    .where(
      and(
        eq(squadRatings.squadId, squadId),
        eq(squadRatings.gameType, gameType),
      ),
    );
  if (existing) return existing;

  const [created] = await db
    .insert(squadRatings)
    .values({
      squadId,
      squadType,
      gameType,
    })
    .returning();
  return created;
}

async function getOrCreateStats(squadId: string, squadType: string) {
  const [existing] = await db
    .select()
    .from(squadStats)
    .where(eq(squadStats.squadId, squadId));
  if (existing) return existing;

  const [created] = await db
    .insert(squadStats)
    .values({
      squadId,
      squadType,
      firstActiveAt: new Date(),
    })
    .returning();
  return created;
}

// deriveTier 已從 services/squad-rating-calc.ts import
const deriveTier = _deriveTier;
