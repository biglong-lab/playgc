// 📊 玩家反饋訊號收集 API
//
// 兩個 endpoint：
//   POST /api/player/feedback   記錄變體 like/dislike/skip
//   POST /api/player/event      記錄玩家行為事件
//
// 一個 query endpoint：
//   GET /api/player/variant-scores?pageId=xxx  取得變體分數（前端 picker 用）
//
// 權限設計：
//   - 玩家用 isAuthenticated（含匿名玩家也能反饋）
//   - 匿名玩家用 sessionId 而非 userId 去重
import type { Express } from "express";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { isAuthenticated } from "../firebaseAuth";
import { db } from "../db";
import {
  variantFeedback,
  playerEventLogs,
  playerEventTypeEnum,
  feedbackActionEnum,
  type InsertVariantFeedback,
  type InsertPlayerEventLog,
} from "@shared/schema";
import {
  getVariantScores,
  invalidateScoresCache,
} from "../lib/feedback-aggregator";

interface UserContext {
  user?: { dbUser?: { id: string }; claims?: { sub: string } };
}

export function registerPlayerFeedbackRoutes(app: Express) {
  // ============================================================================
  // POST /api/player/feedback — 記錄變體反饋
  // ============================================================================
  const feedbackSchema = z.object({
    fieldId: z.string().optional(),
    gameId: z.string().optional(),
    pageId: z.string().min(1).max(50),
    variantKey: z.enum(["success", "fail", "nearMiss", "hint"]),
    variantIndex: z.number().int().min(0).max(50),
    variantText: z.string().max(500).optional(),
    action: z.enum(["like", "dislike", "skip"]),
    sessionId: z.string().optional(),
  });

  app.post("/api/player/feedback", isAuthenticated, async (req, res) => {
    try {
      const parsed = feedbackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "格式驗證失敗",
          details: parsed.error.errors,
        });
      }

      const authReq = req as unknown as UserContext;
      const userId =
        authReq.user?.dbUser?.id || authReq.user?.claims?.sub || null;

      const insert: InsertVariantFeedback = {
        fieldId: parsed.data.fieldId ?? null,
        gameId: parsed.data.gameId ?? null,
        pageId: parsed.data.pageId,
        variantKey: parsed.data.variantKey,
        variantIndex: parsed.data.variantIndex,
        variantText: parsed.data.variantText ?? null,
        action: parsed.data.action,
        userId,
        sessionId: parsed.data.sessionId ?? null,
      };

      // UPSERT：同 user×variant 已存在 → 更新 action
      await db
        .insert(variantFeedback)
        .values(insert)
        .onConflictDoUpdate({
          target: [
            variantFeedback.userId,
            variantFeedback.pageId,
            variantFeedback.variantKey,
            variantFeedback.variantIndex,
          ],
          set: {
            action: parsed.data.action,
            createdAt: new Date(),
          },
        });

      // 失效 cache
      invalidateScoresCache(parsed.data.pageId);

      res.json({ success: true });
    } catch (error) {
      console.error("[player-feedback] POST 失敗:", error);
      res.status(500).json({ error: "記錄反饋失敗" });
    }
  });

  // ============================================================================
  // POST /api/player/event — 記錄玩家行為事件（給 P15 / P16 用）
  // ============================================================================
  const eventSchema = z.object({
    fieldId: z.string().optional(),
    gameId: z.string().optional(),
    pageId: z.string().max(50).optional(),
    sessionId: z.string().optional(),
    eventType: z.enum(playerEventTypeEnum),
    payload: z.record(z.unknown()).optional(),
    durationMs: z.number().int().min(0).optional(),
  });

  app.post("/api/player/event", isAuthenticated, async (req, res) => {
    try {
      const parsed = eventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "格式驗證失敗" });
      }

      const authReq = req as unknown as UserContext;
      const userId =
        authReq.user?.dbUser?.id || authReq.user?.claims?.sub || null;

      const insert: InsertPlayerEventLog = {
        fieldId: parsed.data.fieldId ?? null,
        gameId: parsed.data.gameId ?? null,
        pageId: parsed.data.pageId ?? null,
        sessionId: parsed.data.sessionId ?? null,
        userId,
        eventType: parsed.data.eventType,
        payload: parsed.data.payload ?? null,
        durationMs: parsed.data.durationMs ?? null,
      };

      // 寫入（不 UPSERT — events 是 append-only）
      await db.insert(playerEventLogs).values(insert);

      res.json({ success: true });
    } catch (error) {
      console.error("[player-event] POST 失敗:", error);
      res.status(500).json({ error: "記錄事件失敗" });
    }
  });

  // ============================================================================
  // GET /api/player/variant-scores?pageId=xxx — 取變體分數（前端 picker 用）
  // ============================================================================
  app.get("/api/player/variant-scores", isAuthenticated, async (req, res) => {
    try {
      const pageId = req.query.pageId as string;
      if (!pageId) {
        return res.status(400).json({ error: "缺少 pageId" });
      }
      const scoreMap = await getVariantScores(pageId);
      // Map → plain object（給前端用）
      const scores: Record<string, unknown> = {};
      for (const [key, s] of Array.from(scoreMap.entries())) {
        scores[key] = s;
      }
      res.json({ pageId, scores, count: scoreMap.size });
    } catch (error) {
      console.error("[player-feedback] GET scores 失敗:", error);
      res.status(500).json({ error: "查詢分數失敗" });
    }
  });
}
