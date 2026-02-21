import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import {
  teams,
  teamMembers,
  teamSessions,
  gameSessions,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { isAuthenticated } from "../firebaseAuth";

/** 更新準備狀態的請求驗證 */
const readyBodySchema = z.object({
  isReady: z.boolean(),
});

export function registerTeamLifecycleRoutes(app: Express, ctx: RouteContext) {
  // 更新準備狀態
  app.patch(
    "/api/teams/:teamId/ready",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const body = readyBodySchema.parse(req.body);
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
        });

        if (!membership) {
          return res.status(404).json({ message: "您不在此隊伍中" });
        }

        await db
          .update(teamMembers)
          .set({ isReady: body.isReady })
          .where(eq(teamMembers.id, membership.id));

        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
              with: {
                user: true,
              },
            },
          },
        });

        if (team) {
          const allReady = team.members.every(
            (m) =>
              m.isReady || (m.id === membership.id && body.isReady),
          );
          const hasEnoughPlayers =
            team.members.length >= (team.minPlayers || 2);

          if (allReady && hasEnoughPlayers && team.status === "forming") {
            await db
              .update(teams)
              .set({ status: "ready" })
              .where(eq(teams.id, teamId));
          } else if (team.status === "ready" && !allReady) {
            await db
              .update(teams)
              .set({ status: "forming" })
              .where(eq(teams.id, teamId));
          }
        }

        const updatedTeam = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
              with: {
                user: true,
              },
            },
            game: true,
            leader: true,
          },
        });

        ctx.broadcastToSession(`team_${teamId}`, {
          type: "ready_status_changed",
          team: updatedTeam,
        });

        res.json(updatedTeam);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "更新準備狀態失敗" });
      }
    },
  );

  // 離開隊伍
  app.post(
    "/api/teams/:teamId/leave",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
            },
          },
        });

        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }

        const membership = team.members.find((m) => m.userId === userId);
        if (!membership) {
          return res.status(404).json({ message: "您不在此隊伍中" });
        }

        if (team.leaderId === userId) {
          if (team.members.length === 1) {
            await db
              .update(teams)
              .set({ status: "disbanded" })
              .where(eq(teams.id, teamId));
          } else {
            const newLeader = team.members.find(
              (m) => m.userId !== userId,
            );
            if (newLeader) {
              await db
                .update(teams)
                .set({ leaderId: newLeader.userId })
                .where(eq(teams.id, teamId));
              await db
                .update(teamMembers)
                .set({ role: "leader" })
                .where(eq(teamMembers.id, newLeader.id));
            }
          }
        }

        await db
          .update(teamMembers)
          .set({ leftAt: new Date() })
          .where(eq(teamMembers.id, membership.id));

        ctx.broadcastToSession(`team_${teamId}`, {
          type: "member_left",
          userId,
        });

        res.json({ message: "已離開隊伍" });
      } catch (error) {
        res.status(500).json({ message: "離開隊伍失敗" });
      }
    },
  );

  // 開始遊戲
  app.post(
    "/api/teams/:teamId/start",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
            },
            game: true,
          },
        });

        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }

        if (team.leaderId !== userId) {
          return res
            .status(403)
            .json({ message: "只有隊長可以開始遊戲" });
        }

        if (team.status !== "ready") {
          if (team.members.length < (team.minPlayers || 2)) {
            return res.status(400).json({
              message: `需要至少 ${team.minPlayers || 2} 位玩家才能開始遊戲`,
            });
          }
          if (!team.members.every((m) => m.isReady)) {
            return res
              .status(400)
              .json({ message: "所有隊友都必須準備完成" });
          }
        }

        const [session] = await db
          .insert(gameSessions)
          .values({
            gameId: team.gameId,
            teamName: team.name,
            playerCount: team.members.length,
            status: "playing",
          })
          .returning();

        await db.insert(teamSessions).values({
          teamId: team.id,
          sessionId: session.id,
          teamScore: 0,
          teamInventory: [],
          teamVariables: {},
        });

        await db
          .update(teams)
          .set({
            status: "playing",
            startedAt: new Date(),
          })
          .where(eq(teams.id, teamId));

        for (const member of team.members) {
          await storage.createPlayerProgress({
            sessionId: session.id,
            userId: member.userId,
            inventory: [],
            variables: {},
          });
        }

        ctx.broadcastToSession(`team_${teamId}`, {
          type: "game_started",
          sessionId: session.id,
          gameId: team.gameId,
        });

        res.json({
          sessionId: session.id,
          teamId,
          gameId: team.gameId,
        });
      } catch (error) {
        res.status(500).json({ message: "開始遊戲失敗" });
      }
    },
  );
}
