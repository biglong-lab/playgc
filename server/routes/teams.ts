import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import {
  teams,
  teamMembers,
} from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { registerTeamVoteRoutes } from "./team-votes";
import { registerTeamScoreRoutes } from "./team-scores";
import { registerTeamLifecycleRoutes } from "./team-lifecycle";

/** 建立隊伍的請求驗證 */
const createTeamBodySchema = z.object({
  name: z.string().min(1).max(50).optional(),
});

/** 加入隊伍的請求驗證 */
const joinTeamBodySchema = z.object({
  accessCode: z.string().min(1, "請輸入組隊碼"),
});

function generateAccessCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function registerTeamRoutes(app: Express, ctx: RouteContext) {
  // 註冊子模組路由
  registerTeamVoteRoutes(app, ctx);
  registerTeamScoreRoutes(app, ctx);
  registerTeamLifecycleRoutes(app, ctx);

  // ===========================================
  // 隊伍管理路由 (Team CRUD)
  // ===========================================

  // 建立隊伍
  app.post(
    "/api/games/:gameId/teams",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const game = await storage.getGame(gameId);
        if (!game) {
          return res.status(404).json({ message: "遊戲不存在" });
        }

        const teamModes = ["team", "competitive", "relay"];
        if (!teamModes.includes(game.gameMode ?? "")) {
          return res.status(400).json({ message: "此遊戲不支援團隊模式" });
        }

        const existingMembership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
          with: {
            team: true,
          },
        });

        if (
          existingMembership &&
          existingMembership.team.gameId === gameId &&
          ["forming", "ready", "playing"].includes(
            existingMembership.team.status || "",
          )
        ) {
          return res.status(400).json({
            message: "您已在此遊戲的隊伍中",
            teamId: existingMembership.teamId,
          });
        }

        let accessCode = generateAccessCode();
        let attempts = 0;
        while (attempts < 10) {
          const existing = await db.query.teams.findFirst({
            where: eq(teams.accessCode, accessCode),
          });
          if (!existing) break;
          accessCode = generateAccessCode();
          attempts++;
        }

        const body = createTeamBodySchema.parse(req.body);

        const [team] = await db
          .insert(teams)
          .values({
            gameId,
            name: body.name || `隊伍 ${accessCode}`,
            accessCode,
            leaderId: userId,
            status: "forming",
            minPlayers: game.minTeamPlayers || 2,
            maxPlayers: game.maxTeamPlayers || 6,
            settings: {},
          })
          .returning();

        await db.insert(teamMembers).values({
          teamId: team.id,
          userId,
          role: "leader",
          isReady: false,
        });

        const fullTeam = await db.query.teams.findFirst({
          where: eq(teams.id, team.id),
          with: {
            members: {
              with: {
                user: true,
              },
            },
            game: true,
            leader: true,
          },
        });

        res.status(201).json(fullTeam);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "建立隊伍失敗" });
      }
    },
  );

  // 加入隊伍
  app.post(
    "/api/teams/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const body = joinTeamBodySchema.parse(req.body);
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const team = await db.query.teams.findFirst({
          where: eq(teams.accessCode, body.accessCode.toUpperCase()),
          with: {
            members: {
              where: isNull(teamMembers.leftAt),
            },
            game: true,
          },
        });

        if (!team) {
          return res
            .status(404)
            .json({ message: "找不到此組隊碼對應的隊伍" });
        }

        if (team.status === "completed" || team.status === "disbanded") {
          return res
            .status(400)
            .json({ message: "此隊伍已結束或已解散" });
        }

        if (team.status === "playing") {
          return res
            .status(400)
            .json({ message: "此隊伍正在遊戲中，無法加入" });
        }

        const existingMember = team.members.find((m) => m.userId === userId);
        if (existingMember) {
          return res.status(400).json({ message: "您已經在此隊伍中" });
        }

        if (team.members.length >= (team.maxPlayers || 6)) {
          return res.status(400).json({ message: "隊伍已滿員" });
        }

        await db.insert(teamMembers).values({
          teamId: team.id,
          userId,
          role: "member",
          isReady: false,
        });

        const updatedTeam = await db.query.teams.findFirst({
          where: eq(teams.id, team.id),
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

        ctx.broadcastToSession(`team_${team.id}`, {
          type: "member_joined",
          team: updatedTeam,
        });

        res.json(updatedTeam);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "加入隊伍失敗" });
      }
    },
  );

  // 取得隊伍資料
  app.get(
    "/api/teams/:teamId",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;

        const team = await db.query.teams.findFirst({
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

        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }

        res.json(team);
      } catch (error) {
        res.status(500).json({ message: "取得隊伍資料失敗" });
      }
    },
  );

  // 取得我在此遊戲的隊伍
  app.get(
    "/api/games/:gameId/my-team",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;

        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
          with: {
            team: {
              with: {
                game: true,
                members: {
                  where: isNull(teamMembers.leftAt),
                  with: {
                    user: true,
                  },
                },
                leader: true,
              },
            },
          },
        });

        if (!membership || membership.team.gameId !== gameId) {
          return res.json(null);
        }

        if (
          ["completed", "disbanded"].includes(
            membership.team.status || "",
          )
        ) {
          return res.json(null);
        }

        res.json(membership.team);
      } catch (error) {
        res.status(500).json({ message: "取得隊伍資料失敗" });
      }
    },
  );
}
