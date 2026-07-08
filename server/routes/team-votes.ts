import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import {
  teams,
  teamMembers,
  teamVotes,
  teamVoteBallots,
} from "@shared/schema";
import { eq, and, desc, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { computeVoteCompletion } from "../lib/team-vote-eval";

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

        // 用 broadcastToTeam 對齊 client team_join 房間（事件名 vote_created 已對應 useTeamVoteSync）
        ctx.broadcastToTeam(teamId, {
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

        // 🔒 race condition fix：用 onConflictDoNothing 雙重保險
        // (即使應用層 hasVoted 檢查通過，DB 層 unique constraint 仍會擋第二票)
        const insertResult = await db
          .insert(teamVoteBallots)
          .values({
            voteId,
            userId,
            optionId: body.optionId,
          })
          .onConflictDoNothing({
            target: [teamVoteBallots.voteId, teamVoteBallots.userId],
          })
          .returning();

        if (insertResult.length === 0) {
          // 並發情況：另一個請求先插入了
          return res.status(400).json({ message: "您已經投過票了" });
        }

        // 🗳️ 2026-07-08 CHITO #8687281e：完成判定抽到 lib/team-vote-eval（server 權威）
        //   分子只計「現任成員」的票 — 離開者的舊票不灌高票數
        const memberIds = new Set(vote.team.members.map((m) => m.userId));
        const allBallots = [
          ...vote.ballots.filter((b) => memberIds.has(b.userId)),
          { userId, optionId: body.optionId },
        ];
        const totalMembers = vote.team.members.length;
        const { isComplete, winningOptionId, voteCounts } = computeVoteCompletion(
          vote.votingMode,
          allBallots.map((b) => b.optionId),
          totalMembers,
        );

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

        // 廣播含 userId + optionId，讓 client 可直接更新 ballots
        ctx.broadcastToTeam(vote.teamId, {
          type: "vote_cast",
          voteId,
          userId,
          optionId: body.optionId,
          voteCounts,
          isComplete,
          winningOptionId,
        });

        res.json({
          success: true,
          isComplete,
          winningOptionId,
          voteCounts,
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

        // 🗳️ 2026-07-08 CHITO #8687281e：補回 completed —
        //   原本只回 active，投票一完成就從列表消失 → 晚掛載/重連的玩家
        //   找不到已完成投票 → 重複建新票、也永遠等不到完成訊號
        const votes = await db.query.teamVotes.findMany({
          where: and(
            eq(teamVotes.teamId, teamId),
            inArray(teamVotes.status, ["active", "completed"]),
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
