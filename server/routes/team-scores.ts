import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import {
  teamSessions,
  teamScoreHistory,
  teamMembers,
} from "@shared/schema";
import { eq, desc, and, isNull } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { hotPathLimiter } from "../utils/rate-limiters";

// 🔒 §19 防作弊：sourceType 白名單（玩家不能寫 "manual" 等隨意值）
const ALLOWED_SOURCE_TYPES = new Set([
  "game_complete",
  "game_score",
  "page_complete",
  "qr_scan",
  "lock_solved",
  "vote",
  "shooting",
  "battle",
  "ar_sticker",
  "photo",
  "ocr_match",
]);

// 🔒 單次 delta 上下限（防止一次性灌分）
const MAX_DELTA = 1000;
const MIN_DELTA = -1000;

/** 更新分數的請求驗證 */
const updateScoreBodySchema = z.object({
  delta: z.number().int().min(MIN_DELTA).max(MAX_DELTA),
  sourceType: z.string().refine(
    (s) => ALLOWED_SOURCE_TYPES.has(s),
    { message: "sourceType 不在允許清單" },
  ),
  sourceId: z.string().optional(),
  description: z.string().max(200).optional(),
});

export function registerTeamScoreRoutes(app: Express, ctx: RouteContext) {
  // 更新隊伍分數（per-user 60/min 防爆刷）
  app.post(
    "/api/teams/:teamId/score",
    isAuthenticated,
    hotPathLimiter,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const body = updateScoreBodySchema.parse(req.body);
        const userId = req.user?.dbUser?.id || req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        // 🔒 §19 防作弊：必須是該隊成員才能改分
        const [member] = await db
          .select()
          .from(teamMembers)
          .where(
            and(
              eq(teamMembers.teamId, teamId),
              eq(teamMembers.userId, userId),
              isNull(teamMembers.leftAt),
            ),
          )
          .limit(1);

        if (!member) {
          return res.status(403).json({ message: "您不是此隊成員，無法更新分數" });
        }

        const teamSession = await db.query.teamSessions.findFirst({
          where: eq(teamSessions.teamId, teamId),
          orderBy: [desc(teamSessions.createdAt)],
        });

        if (!teamSession) {
          return res
            .status(404)
            .json({ message: "隊伍遊戲紀錄不存在" });
        }

        // 🛡️ 2026-07-04 多人穩定性 Phase B5：原子累加（DB 端 team_score + delta）
        //   原本 read-modify-write（先讀再寫絕對值）→ 兩人同時加分會互相蓋掉（lost update）
        const [updatedSession] = await db
          .update(teamSessions)
          .set({
            teamScore: sql`COALESCE(${teamSessions.teamScore}, 0) + ${body.delta}`,
            updatedAt: new Date(),
          })
          .where(eq(teamSessions.id, teamSession.id))
          .returning({ teamScore: teamSessions.teamScore });
        const newScore = updatedSession?.teamScore ?? (teamSession.teamScore || 0) + body.delta;

        await db.insert(teamScoreHistory).values({
          teamId,
          delta: body.delta,
          runningTotal: newScore,
          sourceType: body.sourceType,
          sourceId: body.sourceId,
          description: body.description,
        });

        // 用 broadcastToTeam 對齊 client；事件名 score_update → team_score_update（client 期望 team_ 前綴）
        // 補 score / change / reason 欄位（client onScoreUpdate 簽名要求）+ 保留 delta/newScore 欄位向下相容
        ctx.broadcastToTeam(teamId, {
          type: "team_score_update",
          score: newScore,
          change: body.delta,
          reason: body.description ?? body.sourceType ?? "",
          delta: body.delta,
          newScore,
          sourceType: body.sourceType,
          description: body.description,
        });

        res.json({
          previousScore: teamSession.teamScore || 0,
          delta: body.delta,
          newScore,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "更新分數失敗" });
      }
    },
  );

  // 取得分數紀錄
  app.get(
    "/api/teams/:teamId/score-history",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;

        const history = await db.query.teamScoreHistory.findMany({
          where: eq(teamScoreHistory.teamId, teamId),
          orderBy: [desc(teamScoreHistory.createdAt)],
          limit: 50,
        });

        res.json(history);
      } catch (error) {
        res.status(500).json({ message: "取得分數紀錄失敗" });
      }
    },
  );
}
