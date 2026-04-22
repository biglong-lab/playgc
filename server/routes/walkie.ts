// 📻 玩家端對講機路由
//
// 三種 room 來源：
//   1. walkie_groups（獨立語音群組，個人模式/跨遊戲也能用）← 優先
//   2. team（遊戲內組隊模式）
//   3. session（個人模式降級 — 只有自己一人）
import type { Express } from "express";
import { isAuthenticated } from "../firebaseAuth";
import type { AuthenticatedRequest } from "./types";
import { z } from "zod";
import { storage } from "../storage";
import { db } from "../db";
import { walkieGroups, walkieGroupMembers } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import {
  createPlayerToken,
  isLiveKitConfigured,
  LIVEKIT_PUBLIC_URL,
  getTeamRoomName,
  getSessionRoomName,
} from "../lib/livekit";

const tokenRequestSchema = z.object({
  // nullable：前端若沒值會傳 null（不是 undefined），zod optional 不接 null
  sessionId: z.string().nullable().optional(),
  /** 若帶此，優先用 walkie group room（個人模式/跨遊戲都可用） */
  groupId: z.string().nullable().optional(),
});

const createGroupSchema = z.object({
  displayName: z.string().max(100).optional(),
  gameId: z.string().optional(),
});

const joinGroupSchema = z.object({
  accessCode: z.string().min(1, "請輸入語音群組代碼"),
});

/** 生成 6 碼 accessCode
 * 排除易混字：
 *   - 0/O（零/歐）
 *   - 1/I/L（一/艾/L）
 *   - M/N（某些字型下難分辨）← 保留 M
 *   - 2/Z（保留 2）
 *   - 5/S（保留 5）
 *   - B/8（保留 8）
 * 留下 26 字：A,C,D,E,F,G,H,J,K,P,Q,R,T,U,V,W,X,Y,3,4,6,7,8,9,M,2
 */
function generateAccessCode(): string {
  const chars = "ACDEFGHJKMPQRTUVWXY234679";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * 取得 group 的 room name
 */
function getWalkieGroupRoomName(groupId: string): string {
  return `walkie-group-${groupId}`;
}

export function registerWalkieRoutes(app: Express) {
  /**
   * 玩家取得 LiveKit token
   * 優先順序：groupId > sessionId.teamId > sessionId（降級為個人 room）
   */
  app.post("/api/walkie/token", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      if (!isLiveKitConfigured()) {
        return res.status(503).json({
          message: "對講機服務未啟用（LiveKit 未設定）",
        });
      }

      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ message: "未認證" });
      }

      const parsed = tokenRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || "驗證失敗",
        });
      }

      const { sessionId, groupId } = parsed.data;

      let roomName: string;
      let roomLabel: string | undefined;

      // 1. 優先用 walkie group
      if (groupId) {
        const [group] = await db
          .select()
          .from(walkieGroups)
          .where(eq(walkieGroups.id, groupId));
        if (!group) {
          return res.status(404).json({ message: "語音群組不存在" });
        }
        // 驗證玩家是成員（或是建立者）
        const [membership] = await db
          .select()
          .from(walkieGroupMembers)
          .where(
            and(
              eq(walkieGroupMembers.groupId, groupId),
              eq(walkieGroupMembers.userId, userId),
              isNull(walkieGroupMembers.leftAt),
            ),
          );
        if (!membership && group.creatorId !== userId) {
          return res.status(403).json({ message: "您不是此語音群組的成員" });
        }
        roomName = getWalkieGroupRoomName(groupId);
        roomLabel = group.displayName || "語音群組";
      } else if (sessionId) {
        // 2. 依 session 決定（原行為）
        const session = await storage.getSession(sessionId);
        if (!session) {
          return res.status(404).json({ message: "Session 不存在" });
        }
        const teamId = (session as { teamId?: string | null }).teamId;
        roomName = teamId
          ? getTeamRoomName(teamId)
          : getSessionRoomName(sessionId);
      } else {
        return res
          .status(400)
          .json({ message: "需提供 sessionId 或 groupId" });
      }

      // 取得玩家顯示名
      const user = await storage.getUser(userId);
      const displayName = user?.firstName
        ? `${user.firstName}${user.lastName ?? ""}`
        : "玩家";

      const token = await createPlayerToken({
        roomName,
        identity: userId,
        displayName,
      });

      res.json({
        token,
        roomName,
        wsUrl: LIVEKIT_PUBLIC_URL,
        displayName,
        roomLabel,
      });
    } catch (error) {
      console.error("[walkie] token 失敗:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "取得對講機 token 失敗",
      });
    }
  });

  /**
   * 建立語音群組
   */
  app.post(
    "/api/walkie/groups",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "未認證" });

        const parsed = createGroupSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: parsed.error.errors[0]?.message || "驗證失敗" });
        }

        // 生成唯一 accessCode（最多嘗試 5 次）
        let accessCode = "";
        for (let i = 0; i < 5; i++) {
          accessCode = generateAccessCode();
          const [existing] = await db
            .select()
            .from(walkieGroups)
            .where(eq(walkieGroups.accessCode, accessCode));
          if (!existing) break;
        }

        // 預設 24h 過期
        const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);

        const [group] = await db
          .insert(walkieGroups)
          .values({
            accessCode,
            creatorId: userId,
            gameId: parsed.data.gameId,
            displayName: parsed.data.displayName,
            status: "active",
            maxMembers: 10,
            expiresAt,
          })
          .returning();

        // 建立者自動成為成員
        await db.insert(walkieGroupMembers).values({
          groupId: group.id,
          userId,
        });

        res.status(201).json({
          id: group.id,
          accessCode: group.accessCode,
          displayName: group.displayName,
          expiresAt: group.expiresAt,
        });
      } catch (error) {
        console.error("[walkie] create group 失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "建立語音群組失敗",
        });
      }
    },
  );

  /**
   * 加入語音群組（靠 accessCode）
   */
  app.post(
    "/api/walkie/groups/join",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "未認證" });

        const parsed = joinGroupSchema.safeParse(req.body);
        if (!parsed.success) {
          return res
            .status(400)
            .json({ message: parsed.error.errors[0]?.message || "驗證失敗" });
        }

        const code = parsed.data.accessCode.toUpperCase().trim();

        const [group] = await db
          .select()
          .from(walkieGroups)
          .where(eq(walkieGroups.accessCode, code));
        if (!group) {
          return res.status(404).json({ message: "找不到此語音群組" });
        }
        if (group.status !== "active") {
          return res.status(400).json({ message: "此群組已關閉" });
        }
        if (group.expiresAt && group.expiresAt < new Date()) {
          return res.status(400).json({ message: "此群組已過期" });
        }

        // 檢查人數上限
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(walkieGroupMembers)
          .where(
            and(
              eq(walkieGroupMembers.groupId, group.id),
              isNull(walkieGroupMembers.leftAt),
            ),
          );
        if (count >= (group.maxMembers ?? 10)) {
          return res.status(400).json({ message: "群組人數已滿" });
        }

        // 檢查是否已是成員
        const [existingMember] = await db
          .select()
          .from(walkieGroupMembers)
          .where(
            and(
              eq(walkieGroupMembers.groupId, group.id),
              eq(walkieGroupMembers.userId, userId),
            ),
          );

        if (existingMember) {
          // 之前離開過 → 重新加入
          if (existingMember.leftAt) {
            await db
              .update(walkieGroupMembers)
              .set({ leftAt: null, joinedAt: new Date() })
              .where(eq(walkieGroupMembers.id, existingMember.id));
          }
          // 已是成員，無須重加
        } else {
          await db.insert(walkieGroupMembers).values({
            groupId: group.id,
            userId,
          });
        }

        res.json({
          id: group.id,
          accessCode: group.accessCode,
          displayName: group.displayName,
          expiresAt: group.expiresAt,
        });
      } catch (error) {
        console.error("[walkie] join group 失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "加入群組失敗",
        });
      }
    },
  );

  /**
   * 取得我目前加入的語音群組（UI 自動恢復用）
   */
  app.get(
    "/api/walkie/groups/my",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "未認證" });

        // 撈最近加入、未離開、未過期的群組
        const rows = await db
          .select({
            group: walkieGroups,
          })
          .from(walkieGroupMembers)
          .innerJoin(walkieGroups, eq(walkieGroupMembers.groupId, walkieGroups.id))
          .where(
            and(
              eq(walkieGroupMembers.userId, userId),
              isNull(walkieGroupMembers.leftAt),
              eq(walkieGroups.status, "active"),
            ),
          )
          .orderBy(walkieGroupMembers.joinedAt)
          .limit(1);

        if (rows.length === 0) {
          return res.json({ group: null });
        }

        const group = rows[0].group;
        // 過期檢查
        if (group.expiresAt && group.expiresAt < new Date()) {
          return res.json({ group: null });
        }

        res.json({
          group: {
            id: group.id,
            accessCode: group.accessCode,
            displayName: group.displayName,
            expiresAt: group.expiresAt,
          },
        });
      } catch (error) {
        console.error("[walkie] my group 失敗:", error);
        res.status(500).json({ message: "查詢失敗" });
      }
    },
  );

  /**
   * 離開語音群組
   */
  app.post(
    "/api/walkie/groups/:groupId/leave",
    isAuthenticated,
    async (req: AuthenticatedRequest, res) => {
      try {
        const userId = req.user?.claims?.sub;
        if (!userId) return res.status(401).json({ message: "未認證" });

        const { groupId } = req.params;
        await db
          .update(walkieGroupMembers)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(walkieGroupMembers.groupId, groupId),
              eq(walkieGroupMembers.userId, userId),
              isNull(walkieGroupMembers.leftAt),
            ),
          );
        res.json({ ok: true });
      } catch (error) {
        console.error("[walkie] leave group 失敗:", error);
        res.status(500).json({ message: "離開失敗" });
      }
    },
  );
}
