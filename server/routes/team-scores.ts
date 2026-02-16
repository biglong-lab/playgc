import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import { teamSessions, teamScoreHistory } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";

/** 更新分數的請求驗證 */
const updateScoreBodySchema = z.object({
  delta: z.number(),
  sourceType: z.string().optional(),
  sourceId: z.string().optional(),
  description: z.string().optional(),
});

export function registerTeamScoreRoutes(app: Express, ctx: RouteContext) {
  // 更新隊伍分數
  app.post(
    "/api/teams/:teamId/score",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const body = updateScoreBodySchema.parse(req.body);
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
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

        const newScore = (teamSession.teamScore || 0) + body.delta;

        await db
          .update(teamSessions)
          .set({
            teamScore: newScore,
            updatedAt: new Date(),
          })
          .where(eq(teamSessions.id, teamSession.id));

        await db.insert(teamScoreHistory).values({
          teamId,
          delta: body.delta,
          runningTotal: newScore,
          sourceType: body.sourceType || "manual",
          sourceId: body.sourceId,
          description: body.description,
        });

        ctx.broadcastToSession(`team_${teamId}`, {
          type: "score_update",
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
