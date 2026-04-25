// 水彈對戰 PK 擂台 — 對戰結果 + ELO 計算路由
import type { Express } from "express";
import { requireAdminAuth } from "../adminAuth";
import { battleStorageMethods, getPlayerResultsByResultWithNames } from "../storage/battle-storage";
import { insertBattleResultSchema, insertPlayerResultSchema, getTierFromRating } from "@shared/schema";
import { calculateElo, teamAvgRating } from "../services/battle-elo";
import { checkAndUnlockAchievements } from "../services/battle-achievement-checker";
import type { RouteContext } from "./types";
import { z } from "zod";
import { buildDisplayName } from "../utils/display-name";

export function registerBattleResultRoutes(app: Express, ctx: RouteContext) {
  // ============================================================================
  // POST /api/battle/slots/:slotId/result — 記錄對戰結果（管理員）
  // ============================================================================
  app.post(
    "/api/battle/slots/:slotId/result",
    requireAdminAuth,
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ error: "未認證" });
        }

        const { slotId } = req.params;

        // 驗證時段
        const slot = await battleStorageMethods.getSlot(slotId);
        if (!slot) {
          return res.status(404).json({ error: "時段不存在" });
        }
        if (slot.status !== "in_progress" && slot.status !== "completed") {
          return res.status(400).json({ error: "只有進行中或已完成的時段可以記錄結果" });
        }

        // 檢查是否已有結果
        const existing = await battleStorageMethods.getResultBySlot(slotId);
        if (existing) {
          return res.status(409).json({ error: "此時段已有結果記錄" });
        }

        const venue = await battleStorageMethods.getVenue(slot.venueId);
        if (!venue) {
          return res.status(404).json({ error: "場地不存在" });
        }

        // 解析結果資料
        const resultData = insertBattleResultSchema.parse(req.body);
        const playerResultsRaw = req.body.playerResults as unknown[];

        // 驗證個人戰績
        let playerResults: z.infer<typeof insertPlayerResultSchema>[] = [];
        if (Array.isArray(playerResultsRaw) && playerResultsRaw.length > 0) {
          playerResults = playerResultsRaw.map((p) => insertPlayerResultSchema.parse(p));
        }

        // 建立對戰結果
        const result = await battleStorageMethods.createResult({
          slotId,
          venueId: slot.venueId,
          winningTeam: resultData.winningTeam,
          isDraw: resultData.isDraw,
          teamScores: resultData.teamScores ?? [],
          durationMinutes: resultData.durationMinutes,
          mvpUserId: resultData.mvpUserId,
          highlights: resultData.highlights ?? [],
          photos: resultData.photos ?? [],
          notes: resultData.notes,
          recordedBy: req.admin.id,
        });

        // 收集隊伍 rating 用於 ELO 計算
        const teamRatings: Record<string, number[]> = {};
        for (const pr of playerResults) {
          if (!teamRatings[pr.team]) teamRatings[pr.team] = [];
          const ranking = await battleStorageMethods.getOrCreateRanking(pr.userId, venue.fieldId);
          teamRatings[pr.team].push(ranking.rating);
        }

        // 計算每位玩家的 ELO 並建立個人戰績
        const playerResultInserts = [];
        for (const pr of playerResults) {
          const ranking = await battleStorageMethods.getOrCreateRanking(pr.userId, venue.fieldId);

          // 對手隊伍的平均 rating
          const opponentTeams = Object.entries(teamRatings)
            .filter(([team]) => team !== pr.team)
            .flatMap(([, ratings]) => ratings);
          const opponentAvg = teamAvgRating(opponentTeams);

          const won = !resultData.isDraw && resultData.winningTeam === pr.team;
          const lost = !resultData.isDraw && resultData.winningTeam !== pr.team;

          const eloResult = calculateElo({
            playerRating: ranking.rating,
            opponentAvgRating: opponentAvg,
            won,
            isDraw: resultData.isDraw,
            totalBattles: ranking.totalBattles,
            isMvp: pr.isMvp,
            winStreak: won ? ranking.winStreak + 1 : 0,
          });

          playerResultInserts.push({
            resultId: result.id,
            userId: pr.userId,
            team: pr.team,
            score: pr.score,
            hits: pr.hits,
            eliminations: pr.eliminations,
            deaths: pr.deaths,
            isMvp: pr.isMvp,
            ratingBefore: ranking.rating,
            ratingAfter: eloResult.newRating,
            ratingChange: eloResult.ratingChange,
          });

          // 更新排名
          const newWinStreak = won ? ranking.winStreak + 1 : 0;
          await battleStorageMethods.updateRanking(ranking.id, {
            rating: eloResult.newRating,
            tier: eloResult.newTier,
            totalBattles: ranking.totalBattles + 1,
            wins: ranking.wins + (won ? 1 : 0),
            losses: ranking.losses + (lost ? 1 : 0),
            draws: ranking.draws + (resultData.isDraw ? 1 : 0),
            winStreak: newWinStreak,
            bestStreak: Math.max(ranking.bestStreak, newWinStreak),
            mvpCount: ranking.mvpCount + (pr.isMvp ? 1 : 0),
          });
        }

        // 批次寫入個人戰績
        const savedPlayerResults = await battleStorageMethods.createPlayerResults(playerResultInserts);

        // 檢測並解鎖成就
        const allUnlocked: Record<string, unknown[]> = {};
        for (const pr of playerResults) {
          const ranking = await battleStorageMethods.getOrCreateRanking(pr.userId, venue.fieldId);
          const unlocked = await checkAndUnlockAchievements(
            pr.userId,
            {
              totalBattles: ranking.totalBattles,
              wins: ranking.wins,
              winStreak: ranking.winStreak,
              bestStreak: ranking.bestStreak,
              mvpCount: ranking.mvpCount,
              tier: ranking.tier,
            },
            result.id,
          );
          if (unlocked.length > 0) {
            allUnlocked[pr.userId] = unlocked;
          }
        }

        // 更新時段為 completed
        if (slot.status === "in_progress") {
          await battleStorageMethods.updateSlot(slotId, { status: "completed" });
        }

        // WebSocket 廣播結果
        ctx.broadcastToBattleSlot(slotId, {
          type: "battle_result_published",
          slotId,
          winningTeam: resultData.winningTeam,
          isDraw: resultData.isDraw,
          timestamp: new Date().toISOString(),
        });

        // 🆕 Phase 13 修復：寫入 squad_match_records（用真實 clan id + venue.fieldId）
        try {
          const { writeSquadRecordFromBattle } = await import(
            "../services/squad-record-writer"
          );

          // 1. 取真正的 fieldId（從 venue 查）
          const venueRecord = await battleStorageMethods.getVenue(slot.venueId);
          const realFieldId = venueRecord?.fieldId ?? slot.venueId;

          // 2. 取每個玩家所屬的戰隊（如果有）+ 對戰時長
          const realDurationSec =
            resultData.durationMinutes && resultData.durationMinutes > 0
              ? resultData.durationMinutes * 60
              : 600; // 預設 10 分鐘

          // 3. 依「team + 戰隊」分組（同戰隊同 team 才視為同 squad）
          // 規則：clan 玩家用 clan.id；無 clan 玩家用 `solo:${userId}`
          //
          // 注意：水彈對戰可能是 clan vs clan，也可能是 random matchmaking
          //
          // 取每個 user 的 clan 資訊
          const userClansMap = new Map<string, string | null>();
          for (const pr of savedPlayerResults) {
            const userClan = await battleStorageMethods
              .getUserClan(pr.userId, realFieldId)
              .catch(() => null);
            userClansMap.set(pr.userId, userClan?.clan?.id ?? null);
          }

          // 4. 對每個玩家寫 squad_record
          // 同戰隊的玩家共用一個 squadId，去重
          const writtenClans = new Set<string>();
          for (const pr of savedPlayerResults) {
            const result: "win" | "loss" | "draw" = resultData.isDraw
              ? "draw"
              : pr.team === resultData.winningTeam
                ? "win"
                : "loss";

            const clanId = userClansMap.get(pr.userId);
            const squadId = clanId ?? `solo:${pr.userId}`;
            const squadType = clanId ? "clan" : "premade_group";

            // clan 玩家：每個 clan 只寫一筆（避免 N 個玩家寫 N 筆同戰績）
            if (clanId) {
              if (writtenClans.has(clanId)) continue;
              writtenClans.add(clanId);
            }

            await writeSquadRecordFromBattle({
              squadId,
              squadType,
              result,
              slotId,
              fieldId: realFieldId,
              durationSec: realDurationSec,
              performance: {
                eliminations: pr.eliminations ?? 0,
                deaths: pr.deaths ?? 0,
                isMvp: pr.isMvp ?? false,
                hits: pr.hits ?? 0,
              },
            });
          }
        } catch (err) {
          console.error("[battle-result] squad records 寫入失敗（不影響結算）:", err);
        }

        res.status(201).json({
          result,
          playerResults: savedPlayerResults,
          newAchievements: allUnlocked,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: "資料驗證失敗", details: error.errors });
        }
        res.status(500).json({ error: "記錄結果失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/battle/slots/:slotId/result — 取得對戰結果
  // ============================================================================
  app.get("/api/battle/slots/:slotId/result", async (req, res) => {
    try {
      const result = await battleStorageMethods.getResultBySlot(req.params.slotId);
      if (!result) {
        return res.status(404).json({ error: "尚無結果記錄" });
      }

      const rows = await getPlayerResultsByResultWithNames(result.id);
      const playerResults = rows.map((row) => ({
        ...row.playerResult,
        displayName: buildDisplayName(row.firstName, row.lastName, row.playerResult.userId),
      }));
      res.json({ ...result, playerResults });
    } catch {
      res.status(500).json({ error: "取得結果失敗" });
    }
  });
}
