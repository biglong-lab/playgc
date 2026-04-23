// 📻 管理者廣播路由 + 即時遊戲人數儀表板
//
// 端點：
//   POST /api/admin/walkie/broadcast-tokens — 取得多 room broadcast token
//   GET  /api/admin/walkie/live-stats        — 即時遊戲人數（依隊伍分組）
import type { Express } from "express";
import { requireAdminAuth, requirePermission } from "../adminAuth";
import { z } from "zod";
import { db } from "../db";
import { gameSessions } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import {
  createBroadcasterToken,
  isLiveKitConfigured,
  LIVEKIT_PUBLIC_URL,
  getTeamRoomName,
  getSessionRoomName,
  getRoomParticipantCount,
  listActiveRooms,
} from "../lib/livekit";

const broadcastRequestSchema = z.object({
  target: z.enum(["all", "selected"]),
  teamIds: z.array(z.string()).optional(),
  sessionIds: z.array(z.string()).optional(),
  gameId: z.string().optional(),
});

export function registerAdminWalkieRoutes(app: Express) {
  /**
   * 管理者取得廣播 tokens（可同時連多個 room）
   */
  app.post(
    "/api/admin/walkie/broadcast-tokens",
    requireAdminAuth,
    requirePermission("game:view"), // 場域管理員以上皆可廣播
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ message: "未認證" });
        }
        if (!isLiveKitConfigured()) {
          return res.status(503).json({ message: "對講機服務未啟用" });
        }

        const parsed = broadcastRequestSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            message: parsed.error.errors[0]?.message || "驗證失敗",
          });
        }

        const { target, teamIds, sessionIds, gameId } = parsed.data;

        // 收集 target rooms
        const roomNames: string[] = [];

        if (target === "all") {
          // 所有 active sessions 的 room
          // 若指定 gameId 只廣播到該遊戲；否則全場域
          const whereClause = gameId
            ? and(eq(gameSessions.gameId, gameId), eq(gameSessions.status, "playing"))
            : eq(gameSessions.status, "playing");

          const active = await db
            .select()
            .from(gameSessions)
            .where(whereClause);

          for (const s of active) {
            const teamId = (s as { teamId?: string | null }).teamId;
            if (teamId) {
              const rn = getTeamRoomName(teamId);
              if (!roomNames.includes(rn)) roomNames.push(rn);
            } else {
              roomNames.push(getSessionRoomName(s.id));
            }
          }
        } else {
          // selected：直接按 teamIds/sessionIds 產 room name
          if (teamIds) {
            for (const t of teamIds) roomNames.push(getTeamRoomName(t));
          }
          if (sessionIds) {
            for (const s of sessionIds) roomNames.push(getSessionRoomName(s));
          }
        }

        if (roomNames.length === 0) {
          return res.status(400).json({
            message: "沒有可廣播的 room（目前無玩家在遊戲中）",
          });
        }

        // 產生 token（每個 room 一張）
        const broadcasterName = `場地管理員 ${req.admin.displayName || req.admin.username || ""}`.trim();
        const broadcasterIdentity = `admin-broadcast-${req.admin.accountId}`;

        const tokens = await Promise.all(
          roomNames.map(async (roomName) => {
            const token = await createBroadcasterToken({
              roomName,
              identity: `${broadcasterIdentity}-${roomName}`,
              displayName: broadcasterName,
            });
            const memberCount = await getRoomParticipantCount(roomName);
            return { roomName, token, memberCount };
          }),
        );

        res.json({
          tokens,
          wsUrl: LIVEKIT_PUBLIC_URL,
          broadcasterName,
        });
      } catch (error) {
        console.error("[admin-walkie] broadcast-tokens 失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "取得廣播 token 失敗",
        });
      }
    },
  );

  /**
   * 即時遊戲人數儀表板
   * 依隊伍/場次分組，標記哪些 room 有人開對講機
   */
  app.get(
    "/api/admin/walkie/live-stats",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) {
          return res.status(401).json({ message: "未認證" });
        }

        const gameIdFilter = req.query.gameId as string | undefined;

        // 1. 撈 active sessions — 🔒 只撈自己場域的遊戲對應的 session
        const { games } = await import("@shared/schema");
        const conditions = [eq(gameSessions.status, "playing")];
        if (gameIdFilter) conditions.push(eq(gameSessions.gameId, gameIdFilter));
        if (req.admin.fieldId) conditions.push(eq(games.fieldId, req.admin.fieldId));

        const sessionRows = await db
          .select({ session: gameSessions })
          .from(gameSessions)
          .innerJoin(games, eq(games.id, gameSessions.gameId))
          .where(and(...conditions));

        const sessions = sessionRows.map((r) => r.session);

        // 2. 撈 LiveKit room 狀態
        const liveRooms = isLiveKitConfigured() ? await listActiveRooms() : [];
        const roomMap = new Map<string, number>();
        for (const r of liveRooms) {
          roomMap.set(r.name, r.numParticipants);
        }

        // 3. 依 team 分組彙整
        const byTeam = new Map<
          string,
          {
            teamId: string | null;
            teamName: string;
            sessionIds: string[];
            gameIds: Set<string>;
            memberCount: number;
            walkieOnline: number; // 對講機有連線的人數
          }
        >();

        for (const s of sessions) {
          const teamId = (s as { teamId?: string | null }).teamId;
          const teamName = (s as { teamName?: string | null }).teamName || "個人模式";
          const key = teamId || `session-${s.id}`;
          const roomName = teamId
            ? getTeamRoomName(teamId)
            : getSessionRoomName(s.id);

          if (!byTeam.has(key)) {
            byTeam.set(key, {
              teamId: teamId ?? null,
              teamName,
              sessionIds: [],
              gameIds: new Set(),
              memberCount: 0,
              walkieOnline: roomMap.get(roomName) || 0,
            });
          }
          const entry = byTeam.get(key)!;
          entry.sessionIds.push(s.id);
          if (s.gameId) entry.gameIds.add(s.gameId);
          entry.memberCount += 1;
        }

        const teams = Array.from(byTeam.values()).map((t) => ({
          teamId: t.teamId,
          teamName: t.teamName,
          sessionIds: t.sessionIds,
          gameIds: Array.from(t.gameIds),
          memberCount: t.memberCount,
          walkieOnline: t.walkieOnline,
          hasWalkie: t.walkieOnline > 0,
        }));

        const totalPlaying = sessions.length;

        res.json({
          totalPlaying,
          teams,
          sessionCount: new Set(sessions.map((s) => s.id)).size,
          liveKitEnabled: isLiveKitConfigured(),
          refreshedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error("[admin-walkie] live-stats 失敗:", error);
        res.status(500).json({
          message: error instanceof Error ? error.message : "取得即時統計失敗",
        });
      }
    },
  );
}
