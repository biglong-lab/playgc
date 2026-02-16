// 接力路由 (Relay) — 接力模式專用 API
import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import {
  gameMatches,
  matchParticipants,
  relayConfigSchema,
} from "@shared/schema";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";

// 分配段落的請求驗證
const assignSegmentsBodySchema = z.object({
  relayConfig: relayConfigSchema,
});

// 傳棒的請求驗證
const handoffBodySchema = z.object({
  toUserId: z.string().min(1),
});

export function registerRelayRoutes(app: Express, ctx: RouteContext) {
  // 分配接力段落
  app.post("/api/matches/:matchId/relay/assign", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user?.claims.sub;

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.creatorId !== userId) {
        return res.status(403).json({ error: "只有建立者可以分配段落" });
      }

      const parseResult = assignSegmentsBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "參數驗證失敗", details: parseResult.error.issues });
      }

      const { relayConfig } = parseResult.data;

      // 更新對戰設定
      await db.update(gameMatches)
        .set({ relayConfig, matchMode: "relay", updatedAt: new Date() })
        .where(eq(gameMatches.id, matchId));

      // 取得參與者並分配段落
      const participants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(asc(matchParticipants.joinedAt));

      const segmentCount = relayConfig.segmentCount;

      // 並行更新所有參與者（避免 N+1 逐筆查詢）
      const updateResults = await Promise.all(
        participants.map((p, i) => {
          const segment = (i % segmentCount) + 1;
          const isFirst = segment === 1;
          return db.update(matchParticipants)
            .set({
              relaySegment: segment,
              relayStatus: isFirst ? "active" : "pending",
            })
            .where(eq(matchParticipants.id, p.id))
            .returning();
        }),
      );
      const updatedParticipants = updateResults.map((r) => r[0]);

      ctx.broadcastToMatch(matchId, {
        type: "relay_segments_assigned",
        segments: updatedParticipants.map((p) => ({
          userId: p.userId,
          segment: p.relaySegment,
          status: p.relayStatus,
        })),
        timestamp: new Date().toISOString(),
      });

      return res.json(updatedParticipants);
    } catch (error) {
      return res.status(500).json({ error: "分配段落失敗" });
    }
  });

  // 取得接力進度
  app.get("/api/matches/:matchId/relay/status", async (req, res) => {
    try {
      const { matchId } = req.params;

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });

      const participants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(asc(matchParticipants.relaySegment));

      const completedSegments = participants.filter(
        (p) => p.relayStatus === "completed",
      ).length;

      const activeSegment = participants.find(
        (p) => p.relayStatus === "active",
      );

      return res.json({
        matchId,
        relayConfig: match.relayConfig,
        totalSegments: match.relayConfig?.segmentCount ?? 0,
        completedSegments,
        activeParticipant: activeSegment
          ? { userId: activeSegment.userId, segment: activeSegment.relaySegment }
          : null,
        participants: participants.map((p) => ({
          userId: p.userId,
          segment: p.relaySegment,
          status: p.relayStatus,
          score: p.currentScore,
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: "取得接力進度失敗" });
    }
  });

  // 傳棒（完成自己的段落，啟動下一位）
  app.post("/api/matches/:matchId/relay/handoff", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user?.claims.sub;
      if (!userId) return res.status(401).json({ error: "未認證" });

      const parseResult = handoffBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "參數驗證失敗" });
      }

      // 確認當前使用者是 active 狀態
      const [current] = await db.select()
        .from(matchParticipants)
        .where(and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.userId, userId),
        ));

      if (!current) return res.status(404).json({ error: "未加入此對戰" });
      if (current.relayStatus !== "active") {
        return res.status(400).json({ error: "目前不是您的接力段落" });
      }

      // 完成當前段落
      await db.update(matchParticipants)
        .set({ relayStatus: "completed", completedAt: new Date() })
        .where(eq(matchParticipants.id, current.id));

      // 啟動下一位
      const { toUserId } = parseResult.data;
      const [next] = await db.select()
        .from(matchParticipants)
        .where(and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.userId, toUserId),
        ));

      if (next) {
        await db.update(matchParticipants)
          .set({ relayStatus: "active" })
          .where(eq(matchParticipants.id, next.id));
      }

      ctx.broadcastToMatch(matchId, {
        type: "relay_handoff",
        fromUserId: userId,
        toUserId,
        fromSegment: current.relaySegment,
        toSegment: next?.relaySegment,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        completed: { userId, segment: current.relaySegment },
        active: next ? { userId: toUserId, segment: next.relaySegment } : null,
      });
    } catch (error) {
      return res.status(500).json({ error: "傳棒失敗" });
    }
  });
}
