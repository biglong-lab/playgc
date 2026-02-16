import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import {
  teams,
  teamMembers,
  teamVotes,
  teamVoteBallots,
} from "@shared/schema";
import { eq, and, desc, isNull } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";

/** 建立投票的請求驗證 */
const createVoteBodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        targetPageId: z.string().optional(),
        points: z.number().optional(),
      }),
    )
    .min(2),
  votingMode: z.enum(["majority", "unanimous"]).default("majority"),
  expiresInSeconds: z.number().positive().optional(),
  pageId: z.string().optional(),
});

/** 投票的請求驗證 */
const castVoteBodySchema = z.object({
  optionId: z.string().min(1),
});

export function registerTeamVoteRoutes(app: Express, ctx: RouteContext) {
  // 建立投票
  app.post(
    "/api/teams/:teamId/votes",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        const body = createVoteBodySchema.parse(req.body);

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

        const isMember = team.members.some((m) => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ message: "您不是此隊伍的成員" });
        }

        const expiresAt = body.expiresInSeconds
          ? new Date(Date.now() + body.expiresInSeconds * 1000)
          : null;

        const [vote] = await db
          .insert(teamVotes)
          .values({
            teamId,
            pageId: body.pageId || null,
            title: body.title,
            description: body.description,
            options: body.options.map((opt, idx) => ({
              id: `option_${idx}`,
              label: opt.label,
              targetPageId: opt.targetPageId,
              points: opt.points,
            })),
            votingMode: body.votingMode,
            status: "active",
            expiresAt,
          })
          .returning();

        ctx.broadcastToSession(`team_${teamId}`, {
          type: "vote_created",
          vote,
        });

        res.status(201).json(vote);
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "建立投票失敗" });
      }
    },
  );

  // 投票
  app.post(
    "/api/votes/:voteId/cast",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { voteId } = req.params;
        const body = castVoteBodySchema.parse(req.body);
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
                  where: isNull(teamMembers.leftAt),
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

        const isMember = vote.team.members.some((m) => m.userId === userId);
        if (!isMember) {
          return res.status(403).json({ message: "您不是此隊伍的成員" });
        }

        const hasVoted = vote.ballots.some((b) => b.userId === userId);
        if (hasVoted) {
          return res.status(400).json({ message: "您已經投過票了" });
        }

        await db.insert(teamVoteBallots).values({
          voteId,
          userId,
          optionId: body.optionId,
        });

        const allBallots = [
          ...vote.ballots,
          { userId, optionId: body.optionId },
        ];
        const totalMembers = vote.team.members.length;
        const voteCounts = new Map<string, number>();

        for (const b of allBallots) {
          voteCounts.set(b.optionId, (voteCounts.get(b.optionId) || 0) + 1);
        }

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
          for (const [optId, count] of Array.from(voteCounts.entries())) {
            if (count >= majorityNeeded) {
              isComplete = true;
              winningOptionId = optId;
              break;
            }
          }
          if (allBallots.length === totalMembers && !isComplete) {
            isComplete = true;
            let maxVotes = 0;
            for (const [optId, count] of Array.from(voteCounts.entries())) {
              if (count > maxVotes) {
                maxVotes = count;
                winningOptionId = optId;
              }
            }
          }
        }

        if (isComplete && winningOptionId) {
          await db
            .update(teamVotes)
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
        if (error instanceof z.ZodError) {
          return res
            .status(400)
            .json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "投票失敗" });
      }
    },
  );

  // 取得隊伍投票列表
  app.get(
    "/api/teams/:teamId/votes",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;

        const votes = await db.query.teamVotes.findMany({
          where: and(
            eq(teamVotes.teamId, teamId),
            eq(teamVotes.status, "active"),
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
    },
  );
}
