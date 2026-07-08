// 🆘 Admin 救援路由 — 卡關玩家清單 + 強制簽到
//
// 用途：當玩家因為 GPS 失效、QR 掃不到、代碼錯誤等問題無法簽到，
//      管理員可在控制台一鍵標記到達
//
// 2026-05-22
// 相關文件：docs/changes/2026-05-22-multi-tier-location-verification.md

import type { Express } from "express";
import { storage } from "../storage";
import { requireAdminAuth, requirePermission, logAuditAction } from "../adminAuth";
import { db } from "../db";
import { locations, locationVisits, users } from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { RouteContext } from "./types";

export function registerAdminRescueRoutes(app: Express, ctx: RouteContext) {
  /**
   * 🔍 取得 session 中所有玩家 + 各自未簽到 locations 清單
   *
   * 用於 admin 控制台「卡關玩家」面板
   */
  app.get(
    "/api/admin/sessions/:sessionId/stuck-players",
    requireAdminAuth,
    requirePermission("game:view"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const { sessionId } = req.params;
        const session = await storage.getSession(sessionId);
        if (!session || !session.gameId) {
          return res.status(404).json({ message: "Session not found" });
        }
        const gameId = session.gameId;

        // 取得 session 所屬遊戲的所有 locations
        const allLocations = await db
          .select({
            id: locations.id,
            name: locations.name,
            verificationMode: locations.verificationMode,
            allowAdminRescue: locations.allowAdminRescue,
            orderIndex: locations.orderIndex,
          })
          .from(locations)
          .where(eq(locations.gameId, gameId));

        // 取得所有玩家 progress
        const progressList = await storage.getPlayerProgress(sessionId);

        // 為每個玩家算出「未簽到的 locations」
        // p.userId 在 schema 上可能是 nullable，但邏輯上必有；過濾 null 後再處理
        const validProgress = progressList.filter((p): p is typeof p & { userId: string } =>
          typeof p.userId === "string" && p.userId.length > 0,
        );
        // 🚀 2026-07-09 M2（全站優化盤點）：批次查詢消 N+1 —
        //   原本每玩家各查 user + visits（P×2 次）→ 2 次總查詢 + JS 分組
        const userIds = validProgress.map((p) => p.userId);
        const userRows = userIds.length > 0
          ? await db.query.users.findMany({
              where: inArray(users.id, userIds),
              columns: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                profileImageUrl: true,
              },
            })
          : [];
        const userById = new Map(userRows.map((u) => [u.id, u]));

        const allVisits = await db
          .select({
            locationId: locationVisits.locationId,
            playerId: locationVisits.playerId,
          })
          .from(locationVisits)
          .where(eq(locationVisits.gameSessionId, sessionId));
        const visitsByPlayer = new Map<string, Set<number | string>>();
        for (const v of allVisits) {
          if (!v.playerId) continue;
          const set = visitsByPlayer.get(v.playerId) ?? new Set();
          set.add(v.locationId);
          visitsByPlayer.set(v.playerId, set);
        }

        const players = validProgress.map((p) => {
            const userInfo = userById.get(p.userId);
            const visitedIds = visitsByPlayer.get(p.userId) ?? new Set();

            const pending = allLocations.filter((l) => !visitedIds.has(l.id));

            // 「卡關」判定：超過 5 分鐘無進度更新 + 還有未簽到 location
            const stuckMinutes = p.updatedAt
              ? Math.floor((Date.now() - new Date(p.updatedAt).getTime()) / 60000)
              : 0;
            const isStuck = stuckMinutes >= 5 && pending.length > 0;

            const displayName =
              [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(" ") ||
              userInfo?.email ||
              p.userId;

            return {
              userId: p.userId,
              displayName,
              profileImageUrl: userInfo?.profileImageUrl,
              score: p.score || 0,
              stuckMinutes,
              isStuck,
              completedCount: visitedIds.size,
              totalCount: allLocations.length,
              pendingLocations: pending,
            };
          }),
        );

        res.json({
          sessionId,
          gameId: session.gameId,
          totalLocations: allLocations.length,
          players,
        });
      } catch (error) {
        console.error("[admin-rescue] stuck-players failed:", error);
        res.status(500).json({ message: "Failed to fetch stuck players" });
      }
    },
  );

  /**
   * 🆘 強制標記到達（admin 救援）
   *
   * 寫入 verify_method = 'admin' + verify_metadata 含 admin id / reason
   */
  app.post(
    "/api/admin/sessions/:sessionId/rescue/:playerId/visit/:locationId",
    requireAdminAuth,
    requirePermission("game:edit"),
    async (req, res) => {
      try {
        if (!req.admin) return res.status(401).json({ message: "未認證" });

        const { sessionId, playerId, locationId } = req.params;
        const locId = parseInt(locationId);
        const { reason } = req.body || {};
        if (isNaN(locId)) {
          return res.status(400).json({ message: "Invalid location ID" });
        }

        const session = await storage.getSession(sessionId);
        if (!session) return res.status(404).json({ message: "Session not found" });

        const location = await storage.getLocation(locId);
        if (!location) return res.status(404).json({ message: "Location not found" });

        if (location.gameId !== session.gameId) {
          return res.status(400).json({ message: "Location 不屬於此 session" });
        }
        if (location.allowAdminRescue === false) {
          return res.status(403).json({ message: "此任務點已禁用管理員救援" });
        }

        // 檢查是否已造訪
        const alreadyVisited = await storage.hasVisitedLocation(locId, sessionId, playerId);
        if (alreadyVisited) {
          return res.status(400).json({ message: "已簽到過" });
        }

        // 確認玩家在 session 中
        const progressList = await storage.getPlayerProgress(sessionId);
        const playerProgressEntry = progressList.find((p) => p.userId === playerId);
        if (!playerProgressEntry) {
          return res.status(400).json({ message: "玩家不在此 session" });
        }

        const visit = await storage.createLocationVisit({
          locationId: locId,
          gameSessionId: sessionId,
          playerId,
          completed: true,
          verifyMethod: "admin",
          verifyMetadata: {
            adminUserId: req.admin.id,
            adminUsername: req.admin.username,
            reason: reason || "管理員救援",
            timestamp: new Date().toISOString(),
          },
        });

        // 加分
        const earnedPoints = location.points || 0;
        if (playerProgressEntry && earnedPoints > 0) {
          await storage.updatePlayerProgress(playerProgressEntry.id, {
            score: (playerProgressEntry.score || 0) + earnedPoints,
          });
        }

        // Audit log
        await logAuditAction({
          actorAdminId: req.admin.id,
          action: "rescue_visit",
          targetType: "location",
          targetId: String(locId),
          fieldId: req.admin.fieldId,
          metadata: {
            sessionId,
            playerId,
            reason: reason || "管理員救援",
          },
        });

        // 廣播
        ctx.broadcastToSession(sessionId, {
          type: "location_visited",
          playerId,
          locationId: locId,
          locationName: location.name,
          pointsEarned: earnedPoints,
          via: "admin_rescue",
        });

        res.status(201).json({
          visit,
          rescuedBy: req.admin.username,
        });
      } catch (error) {
        console.error("[admin-rescue] rescue visit failed:", error);
        res.status(500).json({ message: "Failed to rescue visit" });
      }
    },
  );
}
