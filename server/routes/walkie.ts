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
  sessionId: z.string().optional(),
  /** 若帶此，優先用 walkie group room（個人模式/跨遊戲都可用） */
  groupId: z.string().optional(),
});

const createGroupSchema = z.object({
  displayName: z.string().max(100).optional(),
  gameId: z.string().optional(),
});

const joinGroupSchema = z.object({
  accessCode: z.string().min(1, "請輸入語音群組代碼"),
});

/** 生成 6 碼 accessCode（排除易混字 0 O I L 1） */
function generateAccessCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
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

      const { sessionId } = parsed.data;

      // 驗證 session 存在且玩家在內
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session 不存在" });
      }

      // 決定 room：優先用 teamId，沒有就用 sessionId
      // （單機模式 / 解謎類遊戲可能沒有 team）
      const teamId = (session as { teamId?: string | null }).teamId;
      const roomName = teamId
        ? getTeamRoomName(teamId)
        : getSessionRoomName(sessionId);

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
      });
    } catch (error) {
      console.error("[walkie] token 失敗:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "取得對講機 token 失敗",
      });
    }
  });
}
