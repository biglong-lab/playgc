import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import {
  teams,
  teamMembers,
  teamSessions,
  teamVotes,
  teamVoteBallots,
  teamScoreHistory,
  gameSessions,
} from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import type { RouteContext } from "./types";

function generateAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function registerTeamRoutes(app: Express, ctx: RouteContext) {
  // ===========================================
  // Team Mode Routes (組隊模式)
  // ===========================================

  app.post("/api/games/:gameId/teams", isAuthenticated, async (req: any, res) => {
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

      if (game.gameMode !== "team") {
        return res.status(400).json({ message: "此遊戲不支援團隊模式" });
      }

      const existingMembership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.leftAt, null as any)
        ),
        with: {
          team: true,
        },
      });

      if (existingMembership && existingMembership.team.gameId === gameId &&
          ["forming", "ready", "playing"].includes(existingMembership.team.status || "")) {
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

      const { name } = req.body;

      const [team] = await db.insert(teams).values({
        gameId,
        name: name || `隊伍 ${accessCode}`,
        accessCode,
        leaderId: userId,
        status: "forming",
        minPlayers: game.minTeamPlayers || 2,
        maxPlayers: game.maxTeamPlayers || 6,
        settings: {},
      }).returning();

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
      res.status(500).json({ message: "建立隊伍失敗" });
    }
  });

  app.post("/api/teams/join", isAuthenticated, async (req: any, res) => {
    try {
      const { accessCode } = req.body;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      if (!accessCode) {
        return res.status(400).json({ message: "請輸入組隊碼" });
      }

      const team = await db.query.teams.findFirst({
        where: eq(teams.accessCode, accessCode.toUpperCase()),
        with: {
          members: {
            where: eq(teamMembers.leftAt, null as any),
          },
          game: true,
        },
      });

      if (!team) {
        return res.status(404).json({ message: "找不到此組隊碼對應的隊伍" });
      }

      if (team.status === "completed" || team.status === "disbanded") {
        return res.status(400).json({ message: "此隊伍已結束或已解散" });
      }

      if (team.status === "playing") {
        return res.status(400).json({ message: "此隊伍正在遊戲中，無法加入" });
      }

      const existingMember = team.members.find(m => m.userId === userId);
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
            where: eq(teamMembers.leftAt, null as any),
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
      res.status(500).json({ message: "加入隊伍失敗" });
    }
  });

  app.get("/api/teams/:teamId", isAuthenticated, async (req: any, res) => {
    try {
      const { teamId } = req.params;

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        with: {
          members: {
            where: eq(teamMembers.leftAt, null as any),
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
  });

  app.patch("/api/teams/:teamId/ready", isAuthenticated, async (req: any, res) => {
    try {
      const { teamId } = req.params;
      const { isReady } = req.body;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      const membership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.teamId, teamId),
          eq(teamMembers.userId, userId),
          eq(teamMembers.leftAt, null as any)
        ),
      });

      if (!membership) {
        return res.status(404).json({ message: "您不在此隊伍中" });
      }

      await db.update(teamMembers)
        .set({ isReady: isReady })
        .where(eq(teamMembers.id, membership.id));

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        with: {
          members: {
            where: eq(teamMembers.leftAt, null as any),
            with: {
              user: true,
            },
          },
        },
      });

      if (team) {
        const allReady = team.members.every(m => m.isReady || m.id === membership.id && isReady);
        const hasEnoughPlayers = team.members.length >= (team.minPlayers || 2);

        if (allReady && hasEnoughPlayers && team.status === "forming") {
          await db.update(teams)
            .set({ status: "ready" })
            .where(eq(teams.id, teamId));
        } else if (team.status === "ready" && !allReady) {
          await db.update(teams)
            .set({ status: "forming" })
            .where(eq(teams.id, teamId));
        }
      }

      const updatedTeam = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        with: {
          members: {
            where: eq(teamMembers.leftAt, null as any),
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
      res.status(500).json({ message: "更新準備狀態失敗" });
    }
  });

  app.post("/api/teams/:teamId/leave", isAuthenticated, async (req: any, res) => {
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
            where: eq(teamMembers.leftAt, null as any),
          },
        },
      });

      if (!team) {
        return res.status(404).json({ message: "隊伍不存在" });
      }

      const membership = team.members.find(m => m.userId === userId);
      if (!membership) {
        return res.status(404).json({ message: "您不在此隊伍中" });
      }

      if (team.leaderId === userId) {
        if (team.members.length === 1) {
          await db.update(teams)
            .set({ status: "disbanded" })
            .where(eq(teams.id, teamId));
        } else {
          const newLeader = team.members.find(m => m.userId !== userId);
          if (newLeader) {
            await db.update(teams)
              .set({ leaderId: newLeader.userId })
              .where(eq(teams.id, teamId));
            await db.update(teamMembers)
              .set({ role: "leader" })
              .where(eq(teamMembers.id, newLeader.id));
          }
        }
      }

      await db.update(teamMembers)
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
  });

  app.post("/api/teams/:teamId/start", isAuthenticated, async (req: any, res) => {
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
            where: eq(teamMembers.leftAt, null as any),
          },
          game: true,
        },
      });

      if (!team) {
        return res.status(404).json({ message: "隊伍不存在" });
      }

      if (team.leaderId !== userId) {
        return res.status(403).json({ message: "只有隊長可以開始遊戲" });
      }

      if (team.status !== "ready") {
        if (team.members.length < (team.minPlayers || 2)) {
          return res.status(400).json({
            message: `需要至少 ${team.minPlayers || 2} 位玩家才能開始遊戲`,
          });
        }
        if (!team.members.every(m => m.isReady)) {
          return res.status(400).json({ message: "所有隊友都必須準備完成" });
        }
      }

      const [session] = await db.insert(gameSessions).values({
        gameId: team.gameId,
        teamName: team.name,
        playerCount: team.members.length,
        status: "playing",
      }).returning();

      await db.insert(teamSessions).values({
        teamId: team.id,
        sessionId: session.id,
        teamScore: 0,
        teamInventory: [],
        teamVariables: {},
      });

      await db.update(teams)
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
  });

  app.get("/api/games/:gameId/my-team", isAuthenticated, async (req: any, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      const membership = await db.query.teamMembers.findFirst({
        where: and(
          eq(teamMembers.userId, userId),
          eq(teamMembers.leftAt, null as any)
        ),
        with: {
          team: {
            with: {
              game: true,
              members: {
                where: eq(teamMembers.leftAt, null as any),
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

      if (["completed", "disbanded"].includes(membership.team.status || "")) {
        return res.json(null);
      }

      res.json(membership.team);
    } catch (error) {
      res.status(500).json({ message: "取得隊伍資料失敗" });
    }
  });

  app.post("/api/teams/:teamId/votes", isAuthenticated, async (req: any, res) => {
    try {
      const { teamId } = req.params;
      const userId = req.user?.claims?.sub;
      const { title, description, options, votingMode, expiresInSeconds, pageId } = req.body;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      const team = await db.query.teams.findFirst({
        where: eq(teams.id, teamId),
        with: {
          members: {
            where: eq(teamMembers.leftAt, null as any),
          },
        },
      });

      if (!team) {
        return res.status(404).json({ message: "隊伍不存在" });
      }

      const isMember = team.members.some(m => m.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "您不是此隊伍的成員" });
      }

      const expiresAt = expiresInSeconds
        ? new Date(Date.now() + expiresInSeconds * 1000)
        : null;

      const [vote] = await db.insert(teamVotes).values({
        teamId,
        pageId: pageId || null,
        title,
        description,
        options: options.map((opt: any, idx: number) => ({
          id: `option_${idx}`,
          label: opt.label,
          targetPageId: opt.targetPageId,
          points: opt.points,
        })),
        votingMode: votingMode || "majority",
        status: "active",
        expiresAt,
      }).returning();

      ctx.broadcastToSession(`team_${teamId}`, {
        type: "vote_created",
        vote,
      });

      res.status(201).json(vote);
    } catch (error) {
      res.status(500).json({ message: "建立投票失敗" });
    }
  });

  app.post("/api/votes/:voteId/cast", isAuthenticated, async (req: any, res) => {
    try {
      const { voteId } = req.params;
      const { optionId } = req.body;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      const vote = await db.query.teamVotes.findFirst({
        where: eq(teamVotes.id, voteId),
        with: {
          team: {
            with: {
              members: {
                where: eq(teamMembers.leftAt, null as any),
              },
            },
          },
          ballots: true,
        },
      });

      if (!vote) {
        return res.status(404).json({ message: "投票不存在" });
      }

      if (vote.status !== "active") {
        return res.status(400).json({ message: "此投票已結束" });
      }

      if (vote.expiresAt && new Date(vote.expiresAt) < new Date()) {
        return res.status(400).json({ message: "投票已過期" });
      }

      const isMember = vote.team.members.some(m => m.userId === userId);
      if (!isMember) {
        return res.status(403).json({ message: "您不是此隊伍的成員" });
      }

      const hasVoted = vote.ballots.some(b => b.userId === userId);
      if (hasVoted) {
        return res.status(400).json({ message: "您已經投過票了" });
      }

      await db.insert(teamVoteBallots).values({
        voteId,
        userId,
        optionId,
      });

      const allBallots = [...vote.ballots, { userId, optionId }];
      const totalMembers = vote.team.members.length;
      const voteCounts = new Map<string, number>();

      allBallots.forEach(b => {
        voteCounts.set(b.optionId, (voteCounts.get(b.optionId) || 0) + 1);
      });

      let isComplete = false;
      let winningOptionId: string | null = null;

      if (vote.votingMode === "unanimous") {
        if (allBallots.length === totalMembers) {
          const counts = Array.from(voteCounts.values());
          if (counts.length === 1 && counts[0] === totalMembers) {
            isComplete = true;
            winningOptionId = allBallots[0].optionId;
          }
        }
      } else {
        const majorityNeeded = Math.ceil(totalMembers / 2);
        for (const [optId, count] of voteCounts) {
          if (count >= majorityNeeded) {
            isComplete = true;
            winningOptionId = optId;
            break;
          }
        }
        if (allBallots.length === totalMembers && !isComplete) {
          isComplete = true;
          let maxVotes = 0;
          for (const [optId, count] of voteCounts) {
            if (count > maxVotes) {
              maxVotes = count;
              winningOptionId = optId;
            }
          }
        }
      }

      if (isComplete && winningOptionId) {
        await db.update(teamVotes)
          .set({
            status: "completed",
            winningOptionId,
            completedAt: new Date(),
          })
          .where(eq(teamVotes.id, voteId));
      }

      ctx.broadcastToSession(`team_${vote.teamId}`, {
        type: "vote_cast",
        voteId,
        voteCounts: Object.fromEntries(voteCounts),
        isComplete,
        winningOptionId,
      });

      res.json({
        success: true,
        isComplete,
        winningOptionId,
        voteCounts: Object.fromEntries(voteCounts),
      });
    } catch (error) {
      res.status(500).json({ message: "投票失敗" });
    }
  });

  app.get("/api/teams/:teamId/votes", isAuthenticated, async (req: any, res) => {
    try {
      const { teamId } = req.params;

      const votes = await db.query.teamVotes.findMany({
        where: and(
          eq(teamVotes.teamId, teamId),
          eq(teamVotes.status, "active")
        ),
        with: {
          ballots: true,
        },
        orderBy: [desc(teamVotes.createdAt)],
      });

      res.json(votes);
    } catch (error) {
      res.status(500).json({ message: "取得投票資料失敗" });
    }
  });

  app.post("/api/teams/:teamId/score", isAuthenticated, async (req: any, res) => {
    try {
      const { teamId } = req.params;
      const { delta, sourceType, sourceId, description } = req.body;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ message: "請先登入" });
      }

      const teamSession = await db.query.teamSessions.findFirst({
        where: eq(teamSessions.teamId, teamId),
        orderBy: [desc(teamSessions.createdAt)],
      });

      if (!teamSession) {
        return res.status(404).json({ message: "隊伍遊戲紀錄不存在" });
      }

      const newScore = (teamSession.teamScore || 0) + delta;

      await db.update(teamSessions)
        .set({
          teamScore: newScore,
          updatedAt: new Date(),
        })
        .where(eq(teamSessions.id, teamSession.id));

      await db.insert(teamScoreHistory).values({
        teamId,
        delta,
        runningTotal: newScore,
        sourceType: sourceType || "manual",
        sourceId,
        description,
      });

      ctx.broadcastToSession(`team_${teamId}`, {
        type: "score_update",
        delta,
        newScore,
        sourceType,
        description,
      });

      res.json({
        previousScore: teamSession.teamScore || 0,
        delta,
        newScore,
      });
    } catch (error) {
      res.status(500).json({ message: "更新分數失敗" });
    }
  });

  app.get("/api/teams/:teamId/score-history", isAuthenticated, async (req: any, res) => {
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
  });
}
