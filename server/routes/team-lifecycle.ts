import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import {
  teams,
  teamMembers,
  teamSessions,
  gameSessions,
  users,
} from "@shared/schema";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { isAuthenticated } from "../firebaseAuth";
// 🗳️ 2026-07-08 CHITO #8687281e：成員離開後重算投票完成（避免投票永久卡住）
import { reevaluateTeamVotes } from "../lib/team-vote-eval";
import { teamActionLimiter } from "../utils/rate-limiters";

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

        // 用 broadcastToTeam 對齊 client 的 team_join；之前 broadcastToSession 廣播到不存在的 session room
        ctx.broadcastToTeam(teamId, {
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

        // 🆕 Phase 2a：明確「離開隊伍」廣播 team_member_left（≠ socket 斷線）
        //   broadcastToTeam 才會送到 lobby（broadcastToSession 是 game session room）
        //   拿 user.firstName 顯示在 toast，失敗也不阻塞 leave 流程
        let userName = userId;
        try {
          const u = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });
          if (u?.firstName) userName = u.firstName;
          else if (u?.email) userName = u.email.split("@")[0];
        } catch {
          /* 拿不到名字也不阻塞 */
        }
        ctx.broadcastToTeam(teamId, {
          type: "team_member_left",
          userId,
          userName,
          timestamp: new Date().toISOString(),
        });

        // 🆕 2026-05-07 A4：踢該 user 的 ws connection（避免幽靈占位）
        // - 先 broadcast team_member_left 讓隊友收到
        // - 再 kick 該 user：他會收到 team_kicked + ws close
        ctx.kickUserFromTeam?.(teamId, userId, "left_team");

        // 🗳️ 2026-07-08：分母變小 → 重算 active 投票（可能因此達標）
        void reevaluateTeamVotes(teamId, ctx.broadcastToTeam);

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

        // 🔧 Fix（2026-05-02）：原本誤用 broadcastToSession + "team_" prefix，
        //   訊息送到不存在的 session room → 隊員永遠收不到 game_started
        //   改用 broadcastToTeam 廣播給該 team 的所有 active 連線
        ctx.broadcastToTeam(teamId, {
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

  // 🆕 Phase 2.B：取得隊伍當前進度（給 GamePlay 進入時跳轉用）
  //   回 { sessionId, maxPageIndex }；找不到 active session 回 404
  app.get(
    "/api/teams/:teamId/active-session",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        // 驗證 user 在此 team 中
        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
        });
        if (!membership) {
          return res.status(403).json({ message: "您不在此隊伍中" });
        }

        const ts = await db.query.teamSessions.findFirst({
          where: eq(teamSessions.teamId, teamId),
          orderBy: [desc(teamSessions.createdAt)],
        });
        if (!ts) {
          return res.status(404).json({ message: "尚無進行中的遊戲" });
        }

        res.json({
          sessionId: ts.sessionId,
          maxPageIndex: ts.maxPageIndex ?? 0,
        });
      } catch (error) {
        res.status(500).json({ message: "查詢進度失敗" });
      }
    },
  );

  // 🆕 Phase 2.B：玩家前進頁面時呼叫 → 用 Math.max 更新隊伍 maxPageIndex
  //   廣播 team_progress_advance 給其他玩家（讓慢的人跟上）
  //   只往前不往後（用 Math.max 保證）
  app.post(
    "/api/teams/:teamId/advance-progress",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const advanceSchema = z.object({
          pageIndex: z.number().int().min(0),
        });
        const body = advanceSchema.parse(req.body);

        // 驗證 user 在此 team
        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
            isNull(teamMembers.leftAt),
          ),
        });
        if (!membership) {
          return res.status(403).json({ message: "您不在此隊伍中" });
        }

        const ts = await db.query.teamSessions.findFirst({
          where: eq(teamSessions.teamId, teamId),
          orderBy: [desc(teamSessions.createdAt)],
        });
        if (!ts) {
          return res.status(404).json({ message: "尚無進行中的遊戲" });
        }

        const currentMax = ts.maxPageIndex ?? 0;
        const newMax = Math.max(currentMax, body.pageIndex);

        // 沒往前 → 不更新不廣播（節省 IO）
        if (newMax === currentMax) {
          return res.json({ maxPageIndex: currentMax, advanced: false });
        }

        await db
          .update(teamSessions)
          .set({ maxPageIndex: newMax, updatedAt: new Date() })
          .where(eq(teamSessions.id, ts.id));

        // 廣播給其他玩家：「有人進到頁面 X 了，跟上」
        ctx.broadcastToTeam(teamId, {
          type: "team_progress_advance",
          maxPageIndex: newMax,
          advancedBy: userId,
          timestamp: new Date().toISOString(),
        });

        res.json({ maxPageIndex: newMax, advanced: true });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "更新進度失敗" });
      }
    },
  );

  // 🆕 Phase 2c+ leader-decide：寬限期過後隊長決定「等待」/「先繼續」
  //   依 docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §11 Phase 2.5 暫緩項
  //   action: "wait" → 取消 autoLeave timer（玩家無限等）+ 廣播 leader_decide_wait
  //   action: "continue" → 立刻設 leftAt + cancel timer + 廣播 team_member_left
  app.post(
    "/api/teams/:teamId/leader-decide",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const decideSchema = z.object({
          targetUserId: z.string().min(1),
          action: z.enum(["wait", "continue"]),
        });
        const body = decideSchema.parse(req.body);

        // 驗證 leader 身份
        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
        });
        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }
        if (team.leaderId !== userId) {
          return res.status(403).json({ message: "只有隊長可以決定" });
        }

        // 🛡️ 2026-07-08 CHITO #0e0f5f17：「先繼續」防呆 —
        //   玩家切背景 30 秒回來已重連，但隊長對話框還開著 → 點「先繼續」
        //   原本不檢查直接設 leftAt → 在線玩家被踢出 → 所有 team API 403
        //   → 永久卡「同步隊伍進度中」且無回歸機制。
        //   修法：目標玩家已有 active ws 連線 → 不設 leftAt、回 already_back。
        if (
          body.action === "continue" &&
          ctx.isUserStillConnected?.(teamId, body.targetUserId)
        ) {
          ctx.cancelDisconnectTimer?.(teamId, body.targetUserId);
          ctx.broadcastToTeam(teamId, {
            type: "team_member_reconnected",
            userId: body.targetUserId,
            userName: body.targetUserId,
            timestamp: new Date().toISOString(),
          });
          return res.json({
            message: "該玩家已重新連線，未移出隊伍",
            action: "already_back",
          });
        }

        // 取消既有 timer（grace + autoLeave）
        ctx.cancelDisconnectTimer?.(teamId, body.targetUserId);

        if (body.action === "wait") {
          // 廣播「隊長選擇等待」— client 顯示「隊長正等 OOO 回來」
          ctx.broadcastToTeam(teamId, {
            type: "team_leader_decide",
            action: "wait",
            targetUserId: body.targetUserId,
            leaderUserId: userId,
            timestamp: new Date().toISOString(),
          });
          return res.json({ message: "已通知隊伍等待", action: "wait" });
        }

        // action === "continue" → 立刻將 target 標為 leftAt + 廣播
        try {
          await db
            .update(teamMembers)
            .set({ leftAt: new Date() })
            .where(
              and(
                eq(teamMembers.teamId, teamId),
                eq(teamMembers.userId, body.targetUserId),
                isNull(teamMembers.leftAt),
              ),
            );

          // 拿 target 顯示名給 toast 用
          let targetUserName = body.targetUserId;
          try {
            const u = await db.query.users.findFirst({
              where: eq(users.id, body.targetUserId),
            });
            if (u?.firstName) targetUserName = u.firstName;
            else if (u?.email) targetUserName = u.email.split("@")[0];
          } catch {
            /* ignore */
          }

          ctx.broadcastToTeam(teamId, {
            type: "team_member_left",
            userId: body.targetUserId,
            userName: targetUserName,
            reason: "leader_continue_decision",
            timestamp: new Date().toISOString(),
          });
          // 🗳️ 2026-07-08：分母變小 → 重算 active 投票（可能因此達標）
          void reevaluateTeamVotes(teamId, ctx.broadcastToTeam);
          res.json({ message: "已將該玩家標為離開", action: "continue" });
        } catch {
          res.status(500).json({ message: "處理離開失敗" });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({ message: "資料驗證失敗", errors: error.errors });
        }
        res.status(500).json({ message: "leader-decide 處理失敗" });
      }
    },
  );

  // 🆕 2026-07-08 CHITO #ec3f612b：查可重新加入的隊伍
  //   情境：玩家退出/被 auto-leave 後重進遊戲 → my-team 回 null →
  //   元件顯示「此元件需要組隊使用」且無路可走。
  //   此端點找出玩家「曾在、已離開、隊伍仍進行中」的隊伍，供 client 顯示
  //   「重新連線原隊伍」入口。
  app.get(
    "/api/games/:gameId/rejoinable-team",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const { gameId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const leftMemberships = await db.query.teamMembers.findMany({
          where: and(
            eq(teamMembers.userId, userId),
            isNotNull(teamMembers.leftAt),
          ),
          with: {
            team: {
              with: {
                members: { where: isNull(teamMembers.leftAt) },
              },
            },
          },
          orderBy: [desc(teamMembers.leftAt)],
        });

        // 只找「此遊戲 + 隊伍仍可玩（forming/ready/playing）」的最近一筆
        const rejoinable = leftMemberships.find(
          (m) =>
            m.team?.gameId === gameId &&
            ["forming", "ready", "playing"].includes(m.team.status || ""),
        );

        if (!rejoinable?.team) {
          return res.json(null);
        }

        res.json({
          teamId: rejoinable.team.id,
          name: rejoinable.team.name,
          status: rejoinable.team.status,
          memberCount: rejoinable.team.members.length,
        });
      } catch (error) {
        res.status(500).json({ message: "查詢可重加入隊伍失敗" });
      }
    },
  );

  // 🆕 2026-07-08 CHITO #ec3f612b：重新加入原隊伍（清 leftAt）
  //   給「被誤踢 / 退出後想回來」的玩家一條回歸路徑。
  //   條件：曾是成員（有 leftAt 紀錄）+ 隊伍仍 forming/ready/playing。
  app.post(
    "/api/teams/:teamId/rejoin",
    isAuthenticated,
    teamActionLimiter, // 🔐 2026-07-09 S3：per-user 防刷
    async (req: AuthenticatedRequest, res) => {
      try {
        const { teamId } = req.params;
        const userId = req.user?.claims?.sub;
        if (!userId) {
          return res.status(401).json({ message: "請先登入" });
        }

        const team = await db.query.teams.findFirst({
          where: eq(teams.id, teamId),
        });
        if (!team) {
          return res.status(404).json({ message: "隊伍不存在" });
        }
        if (!["forming", "ready", "playing"].includes(team.status || "")) {
          return res.status(400).json({ message: "此隊伍已結束，無法重新加入" });
        }

        const membership = await db.query.teamMembers.findFirst({
          where: and(
            eq(teamMembers.teamId, teamId),
            eq(teamMembers.userId, userId),
          ),
        });
        if (!membership) {
          return res
            .status(403)
            .json({ message: "您不曾是此隊伍的成員，請用組隊碼加入" });
        }
        if (!membership.leftAt) {
          // 已是現任成員（冪等）— 直接回成功
          return res.json({ message: "您已在隊伍中", teamId, rejoined: false });
        }

        await db
          .update(teamMembers)
          .set({
            leftAt: null,
            // 遊戲已開打 → 直接視為 ready（避免卡全員 ready 檢查）
            ...(team.status === "playing" ? { isReady: true } : {}),
          })
          .where(eq(teamMembers.id, membership.id));

        // 名字給 toast 用
        let userName = userId;
        try {
          const u = await db.query.users.findFirst({
            where: eq(users.id, userId),
          });
          if (u?.firstName) userName = u.firstName;
          else if (u?.email) userName = u.email.split("@")[0];
        } catch {
          /* 拿不到名字不阻塞 */
        }

        ctx.broadcastToTeam(teamId, {
          type: "team_member_reconnected",
          userId,
          userName,
          reason: "rejoin",
          timestamp: new Date().toISOString(),
        });

        res.json({ message: "已重新加入隊伍", teamId, rejoined: true });
      } catch (error) {
        res.status(500).json({ message: "重新加入隊伍失敗" });
      }
    },
  );
}
