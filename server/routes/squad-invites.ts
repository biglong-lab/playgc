// 推廣連結追蹤路由 — Phase 12.1
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4 §20.7
//
// 端點：
//   POST /api/squads/:squadId/invites          — 隊長產生推廣 token
//   GET  /api/squads/:squadId/invites          — 隊長看自己產生的所有 token
//   GET  /api/invites/:token                   — 取邀請資訊（公開，產 OG 圖用）
//   POST /api/invites/:token/click             — 紀錄點擊（前端 invite 頁面打）
//   POST /api/invites/:token/accept            — 接受邀請（登入後加入隊伍）
//   GET  /api/me/invites/dashboard             — 我作為隊長的推廣效益看板
//
import type { Express } from "express";
import { db } from "../db";
import {
  squadInvites,
  squadStats,
  battleClans,
  squadAchievements,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";
import {
  generateInviteToken,
  isValidInviteToken,
  buildInviteShareUrl,
  computeInviteExpiry,
  isInviteValid,
  calcRecruitReward,
} from "../services/invite-token";

// ============================================================================
// 工具：判斷是否為超級隊長（影響獎勵倍率）
// ============================================================================
async function isSuperLeader(squadId: string): Promise<boolean> {
  const [stats] = await db
    .select()
    .from(squadStats)
    .where(eq(squadStats.squadId, squadId));
  if (!stats) return false;
  return ["gold", "platinum", "super"].includes(
    stats.superLeaderTier ?? "",
  );
}

// ============================================================================
// 工具：取得隊伍 leader / officer userId 清單（驗證權限）
// 目前 squadId 對應 battle_clans.id（未來統一後改 squads.id）
// ============================================================================
async function getSquadLeaderIds(squadId: string): Promise<string[]> {
  const [clan] = await db
    .select()
    .from(battleClans)
    .where(eq(battleClans.id, squadId));
  if (!clan) return [];
  // battle_clans 有 leader_id 欄位（簡化先只認 leader，未來可加 officer）
  return [clan.leaderId].filter(Boolean) as string[];
}

export function registerSquadInvitesRoutes(app: Express) {
  // ============================================================================
  // POST /api/squads/:squadId/invites — 產生新的推廣 token
  // ============================================================================
  const createInviteSchema = z.object({
    expiresInDays: z.number().int().min(1).max(365).optional(), // 預設不過期
  });

  app.post(
    "/api/squads/:squadId/invites",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const squadId = req.params.squadId;
        const parsed = createInviteSchema.safeParse(req.body ?? {});
        if (!parsed.success) {
          return res.status(400).json({
            error: parsed.error.errors[0]?.message ?? "驗證失敗",
          });
        }

        // 權限驗證：只有隊長 / 副隊長可建
        const leaderIds = await getSquadLeaderIds(squadId);
        if (leaderIds.length > 0 && !leaderIds.includes(userId)) {
          return res.status(403).json({ error: "只有隊長可建立推廣連結" });
        }

        const expiresAt = computeInviteExpiry(parsed.data.expiresInDays);

        // 重試最多 3 次避免 token 衝突
        let token = generateInviteToken();
        let created;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const [row] = await db
              .insert(squadInvites)
              .values({
                squadId,
                inviterUserId: userId,
                inviteToken: token,
                expiresAt,
              })
              .returning();
            created = row;
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            token = generateInviteToken();
          }
        }

        res.status(201).json({
          success: true,
          invite: created,
          shareUrl: buildInviteShareUrl(token),
        });
      } catch (error) {
        console.error("[squad-invites] POST 失敗:", error);
        res.status(500).json({
          error: error instanceof Error ? error.message : "建立推廣連結失敗",
        });
      }
    },
  );

  // ============================================================================
  // GET /api/squads/:squadId/invites — 隊長查自己的推廣連結（含轉換統計）
  // ============================================================================
  app.get(
    "/api/squads/:squadId/invites",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const squadId = req.params.squadId;

        // 權限：必須是隊長 / 副隊長
        const leaderIds = await getSquadLeaderIds(squadId);
        if (leaderIds.length > 0 && !leaderIds.includes(userId)) {
          return res.status(403).json({ error: "只有隊長可查看" });
        }

        const invites = await db
          .select()
          .from(squadInvites)
          .where(eq(squadInvites.squadId, squadId))
          .orderBy(desc(squadInvites.createdAt))
          .limit(50);

        // 統計：總點擊 / 總轉換 / 總場次
        const totalClicks = invites.reduce((sum, i) => sum + i.clickCount, 0);
        const totalConverted = invites.filter((i) => i.inviteeUserId).length;
        const totalGamesPlayed = invites.reduce(
          (sum, i) => sum + i.totalGamesPlayed,
          0,
        );

        res.json({
          summary: {
            totalLinks: invites.length,
            totalClicks,
            totalConverted,
            totalGamesPlayed,
            conversionRate:
              totalClicks > 0
                ? Math.round((totalConverted / totalClicks) * 100)
                : 0,
          },
          invites: invites.map((i) => ({
            ...i,
            shareUrl: buildInviteShareUrl(i.inviteToken),
          })),
        });
      } catch (error) {
        console.error("[squad-invites] GET 失敗:", error);
        res.status(500).json({ error: "取得推廣連結失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/invites/:token — 公開 endpoint（給 invite 頁面顯示用 / OG 圖）
  // ============================================================================
  app.get("/api/invites/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!isValidInviteToken(token)) {
        return res.status(400).json({ error: "邀請連結格式錯誤" });
      }

      const [invite] = await db
        .select()
        .from(squadInvites)
        .where(eq(squadInvites.inviteToken, token));

      if (!invite) {
        return res.status(404).json({ error: "邀請連結不存在" });
      }

      const validity = isInviteValid({
        expiresAt: invite.expiresAt,
      });
      if (!validity.valid && validity.reason === "expired") {
        return res.status(410).json({ error: "邀請連結已過期" });
      }

      // 取隊伍基本資訊（隊名、徽章數、場次）
      const [clan] = await db
        .select()
        .from(battleClans)
        .where(eq(battleClans.id, invite.squadId));

      const [stats] = await db
        .select()
        .from(squadStats)
        .where(eq(squadStats.squadId, invite.squadId));

      res.json({
        squadId: invite.squadId,
        squadName: clan?.name ?? "未知隊伍",
        squadTag: clan?.tag ?? null,
        totalGames: stats?.totalGames ?? 0,
        recruitsCount: stats?.recruitsCount ?? 0,
        superLeaderTier: stats?.superLeaderTier ?? null,
        valid: true,
      });
    } catch (error) {
      console.error("[squad-invites] GET token 失敗:", error);
      res.status(500).json({ error: "取得邀請資訊失敗" });
    }
  });

  // ============================================================================
  // POST /api/invites/:token/click — 紀錄點擊（前端 invite 頁載入時打）
  // ============================================================================
  app.post("/api/invites/:token/click", async (req, res) => {
    try {
      const token = req.params.token;
      if (!isValidInviteToken(token)) {
        return res.status(400).json({ error: "邀請連結格式錯誤" });
      }

      const [updated] = await db
        .update(squadInvites)
        .set({
          clickCount: sql`${squadInvites.clickCount} + 1`,
          lastClickedAt: new Date(),
        })
        .where(eq(squadInvites.inviteToken, token))
        .returning({
          id: squadInvites.id,
          clickCount: squadInvites.clickCount,
        });

      if (!updated) return res.status(404).json({ error: "邀請不存在" });
      res.json({ success: true, clickCount: updated.clickCount });
    } catch (error) {
      console.error("[squad-invites] click 失敗:", error);
      res.status(500).json({ error: "紀錄點擊失敗" });
    }
  });

  // ============================================================================
  // POST /api/invites/:token/accept — 玩家登入後接受邀請
  // ============================================================================
  app.post(
    "/api/invites/:token/accept",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const token = req.params.token;
        if (!isValidInviteToken(token)) {
          return res.status(400).json({ error: "邀請連結格式錯誤" });
        }

        const [invite] = await db
          .select()
          .from(squadInvites)
          .where(eq(squadInvites.inviteToken, token));

        if (!invite) return res.status(404).json({ error: "邀請不存在" });

        // 過期檢查
        const validity = isInviteValid({
          expiresAt: invite.expiresAt,
        });
        if (!validity.valid && validity.reason === "expired") {
          return res.status(410).json({ error: "邀請已過期" });
        }

        // 不可邀請自己
        if (invite.inviterUserId === userId) {
          return res.status(400).json({ error: "不可邀請自己" });
        }

        // 已接受過
        if (invite.inviteeUserId === userId) {
          return res.status(200).json({
            success: true,
            alreadyAccepted: true,
            squadId: invite.squadId,
          });
        }

        // 已被其他人接受 → 該邀請不可重複用
        if (invite.inviteeUserId) {
          return res.status(409).json({ error: "邀請已被其他玩家接受" });
        }

        // 寫入 invitee
        const [updated] = await db
          .update(squadInvites)
          .set({
            inviteeUserId: userId,
            joinedAt: new Date(),
          })
          .where(eq(squadInvites.inviteToken, token))
          .returning();

        // 更新隊伍 recruitsCount + monthlyRecruits
        await db
          .update(squadStats)
          .set({
            recruitsCount: sql`${squadStats.recruitsCount} + 1`,
            monthlyRecruits: sql`${squadStats.monthlyRecruits} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(squadStats.squadId, invite.squadId));

        // 招募達人徽章（10 人達標）
        const [statsAfter] = await db
          .select()
          .from(squadStats)
          .where(eq(squadStats.squadId, invite.squadId));

        if (statsAfter && statsAfter.recruitsCount >= 10) {
          await db
            .insert(squadAchievements)
            .values({
              squadId: invite.squadId,
              achievementKey: "recruiter_master",
              category: "recruit",
              displayName: "招募達人",
              description: "成功招募 10 位新玩家",
            })
            .onConflictDoNothing();
        }

        // 發放雙向招募獎勵（超級隊長 ×2）
        const isSuper = await isSuperLeader(invite.squadId);
        const reward = calcRecruitReward({ isSuperLeader: isSuper });
        const expBonus = reward.expBonus;

        // 觸發獎勵引擎事件（reward type = 'recruit'）
        try {
          const { evaluateRules } = await import(
            "../services/reward-engine"
          );
          await evaluateRules({
            squadId: invite.squadId,
            eventType: "recruit",
            sourceId: updated.id,
            sourceType: "squad_invite",
            userId: invite.inviterUserId,
            context: {
              inviteeUserId: userId,
              inviterUserId: invite.inviterUserId,
              expBonus,
              isSuperLeader: isSuper,
            },
          });
        } catch (e) {
          console.warn("[squad-invites] 觸發獎勵引擎失敗（不阻擋）:", e);
        }

        res.json({
          success: true,
          squadId: invite.squadId,
          inviteId: updated.id,
          rewards: { expBonus, isSuperLeader: isSuper },
        });
      } catch (error) {
        console.error("[squad-invites] accept 失敗:", error);
        res.status(500).json({ error: "接受邀請失敗" });
      }
    },
  );

  // ============================================================================
  // GET /api/me/invites/dashboard — 我作為隊長的推廣效益看板
  // ============================================================================
  app.get(
    "/api/me/invites/dashboard",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ error: "Unauthorized" });

        const all = await db
          .select()
          .from(squadInvites)
          .where(eq(squadInvites.inviterUserId, userId))
          .orderBy(desc(squadInvites.createdAt))
          .limit(100);

        // 本月（30 天內）的數據
        const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000);
        const recentInvites = all.filter(
          (i) => i.createdAt && i.createdAt >= thirtyDaysAgo,
        );

        const totalClicks = recentInvites.reduce(
          (sum, i) => sum + i.clickCount,
          0,
        );
        const recentConversions = recentInvites.filter(
          (i) => i.inviteeUserId,
        );
        const totalConverted = recentConversions.length;
        const totalGames = recentConversions.reduce(
          (sum, i) => sum + i.totalGamesPlayed,
          0,
        );
        const activeConverts = recentConversions.filter(
          (i) => i.totalGamesPlayed >= 3,
        ).length;

        res.json({
          monthly: {
            clicks: totalClicks,
            converted: totalConverted,
            conversionRate:
              totalClicks > 0
                ? Math.round((totalConverted / totalClicks) * 100)
                : 0,
            activeConverts,
            totalGamesContributed: totalGames,
          },
          allTime: {
            totalLinks: all.length,
            totalConverted: all.filter((i) => i.inviteeUserId).length,
            totalGamesContributed: all.reduce(
              (sum, i) => sum + i.totalGamesPlayed,
              0,
            ),
          },
          recentLinks: all.slice(0, 10).map((i) => ({
            ...i,
            shareUrl: buildInviteShareUrl(i.inviteToken),
          })),
        });
      } catch (error) {
        console.error("[squad-invites] dashboard 失敗:", error);
        res.status(500).json({ error: "取得 dashboard 失敗" });
      }
    },
  );
}
