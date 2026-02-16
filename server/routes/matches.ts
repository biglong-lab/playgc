// 對戰路由 (Matches) — 競爭模式 API
import type { Express } from "express";
import { db } from "../db";
import { isAuthenticated } from "../firebaseAuth";
import {
  gameMatches,
  matchParticipants,
  games,
  matchSettingsSchema,
  type MatchStatus,
  type MatchSettings,
} from "@shared/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { validateId } from "./utils";
import { registerRelayRoutes } from "./relay";

// 建立對戰的請求驗證
const createMatchBodySchema = z.object({
  matchMode: z.enum(["competitive", "relay"]).default("competitive"),
  settings: matchSettingsSchema.optional(),
  maxTeams: z.number().int().min(2).max(50).optional(),
});

// 更新分數的請求驗證
const updateScoreBodySchema = z.object({
  score: z.number().int(),
});

// 6 碼存取碼產生（避免易混淆字元）
function generateAccessCode(): string {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += charset[Math.floor(Math.random() * charset.length)];
  }
  return code;
}

export function registerMatchRoutes(app: Express, ctx: RouteContext) {
  // 建立對戰
  app.post("/api/games/:gameId/matches", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { gameId } = req.params;
      const userId = req.user?.claims.sub;
      if (!userId) return res.status(401).json({ error: "未認證" });

      const parseResult = createMatchBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "參數驗證失敗", details: parseResult.error.issues });
      }

      // 確認遊戲存在
      const [game] = await db.select().from(games).where(eq(games.id, gameId));
      if (!game) return res.status(404).json({ error: "遊戲不存在" });

      const { matchMode, settings, maxTeams } = parseResult.data;

      const [match] = await db.insert(gameMatches).values({
        gameId,
        creatorId: userId,
        matchMode,
        status: "waiting",
        settings: settings ?? {
          scoringMode: "combined",
          showRealTimeRanking: true,
          countdownSeconds: 3,
        },
        maxTeams: maxTeams ?? 10,
        accessCode: generateAccessCode(),
      }).returning();

      return res.status(201).json(match);
    } catch (error) {
      return res.status(500).json({ error: "建立對戰失敗" });
    }
  });

  // 取得遊戲的對戰列表
  app.get("/api/games/:gameId/matches", async (req, res) => {
    try {
      const { gameId } = req.params;
      const matches = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.gameId, gameId))
        .orderBy(desc(gameMatches.createdAt));

      return res.json(matches);
    } catch (error) {
      return res.status(500).json({ error: "取得對戰列表失敗" });
    }
  });

  // 取得對戰詳情（含參與者與排名）
  app.get("/api/matches/:matchId", async (req, res) => {
    try {
      const { matchId } = req.params;
      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });

      const participants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(desc(matchParticipants.currentScore));

      return res.json({ ...match, participants });
    } catch (error) {
      return res.status(500).json({ error: "取得對戰詳情失敗" });
    }
  });

  // 加入對戰
  app.post("/api/matches/:matchId/join", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user?.claims.sub;
      if (!userId) return res.status(401).json({ error: "未認證" });

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.status !== "waiting") {
        return res.status(400).json({ error: "對戰已開始或結束" });
      }

      // 檢查是否已加入
      const existing = await db.select()
        .from(matchParticipants)
        .where(and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.userId, userId),
        ));

      if (existing.length > 0) {
        return res.status(400).json({ error: "已加入此對戰" });
      }

      // 檢查參與上限
      const allParticipants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId));

      if (match.maxTeams && allParticipants.length >= match.maxTeams) {
        return res.status(400).json({ error: "對戰人數已滿" });
      }

      const [participant] = await db.insert(matchParticipants).values({
        matchId,
        userId,
        currentScore: 0,
      }).returning();

      // WebSocket 廣播有人加入
      ctx.broadcastToMatch(matchId, {
        type: "match_participant_joined",
        userId,
        participantCount: allParticipants.length + 1,
        timestamp: new Date().toISOString(),
      });

      return res.status(201).json(participant);
    } catch (error) {
      return res.status(500).json({ error: "加入對戰失敗" });
    }
  });

  // 開始對戰
  app.post("/api/matches/:matchId/start", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user?.claims.sub;

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.creatorId !== userId) {
        return res.status(403).json({ error: "只有建立者可以開始對戰" });
      }
      if (match.status !== "waiting") {
        return res.status(400).json({ error: "對戰已開始或結束" });
      }

      // 倒數階段
      const settings = match.settings as MatchSettings | null;
      const countdownSeconds = settings?.countdownSeconds ?? 3;

      const [updated] = await db.update(gameMatches)
        .set({ status: "countdown", updatedAt: new Date() })
        .where(eq(gameMatches.id, matchId))
        .returning();

      ctx.broadcastToMatch(matchId, {
        type: "match_countdown",
        seconds: countdownSeconds,
        timestamp: new Date().toISOString(),
      });

      // 倒數由前端處理，完成後透過 WebSocket 通知後端切換狀態
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "開始對戰失敗" });
    }
  });

  // 結束對戰（計算排名）
  app.post("/api/matches/:matchId/finish", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.status !== "playing") {
        return res.status(400).json({ error: "對戰尚未開始" });
      }

      // 取得所有參與者並排名
      const participants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(desc(matchParticipants.currentScore));

      // 並行更新所有排名（避免 N+1 逐筆查詢）
      const now = new Date();
      await Promise.all(
        participants.map((p, i) =>
          db.update(matchParticipants)
            .set({
              finalScore: p.currentScore,
              finalRank: i + 1,
              completedAt: now,
            })
            .where(eq(matchParticipants.id, p.id))
        ),
      );

      const [updated] = await db.update(gameMatches)
        .set({ status: "finished", finishedAt: new Date(), updatedAt: new Date() })
        .where(eq(gameMatches.id, matchId))
        .returning();

      ctx.broadcastToMatch(matchId, {
        type: "match_finished",
        ranking: participants.map((p, i) => ({
          userId: p.userId,
          score: p.currentScore,
          rank: i + 1,
        })),
        timestamp: new Date().toISOString(),
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "結束對戰失敗" });
    }
  });

  // 更新分數（觸發 WebSocket 即時排名）
  app.patch("/api/matches/:matchId/score", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;
      const userId = req.user?.claims.sub;
      if (!userId) return res.status(401).json({ error: "未認證" });

      const parseResult = updateScoreBodySchema.safeParse(req.body);
      if (!parseResult.success) {
        return res.status(400).json({ error: "參數驗證失敗" });
      }

      const [participant] = await db.select()
        .from(matchParticipants)
        .where(and(
          eq(matchParticipants.matchId, matchId),
          eq(matchParticipants.userId, userId),
        ));

      if (!participant) {
        return res.status(404).json({ error: "未加入此對戰" });
      }

      const [updated] = await db.update(matchParticipants)
        .set({ currentScore: parseResult.data.score })
        .where(eq(matchParticipants.id, participant.id))
        .returning();

      // 取得即時排名並廣播
      const allParticipants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(desc(matchParticipants.currentScore));

      ctx.broadcastToMatch(matchId, {
        type: "match_ranking",
        ranking: allParticipants.map((p, i) => ({
          userId: p.userId,
          score: p.currentScore,
          rank: i + 1,
        })),
        timestamp: new Date().toISOString(),
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "更新分數失敗" });
    }
  });

  // 取得即時排名
  app.get("/api/matches/:matchId/ranking", async (req, res) => {
    try {
      const { matchId } = req.params;
      const participants = await db.select()
        .from(matchParticipants)
        .where(eq(matchParticipants.matchId, matchId))
        .orderBy(desc(matchParticipants.currentScore));

      const ranking = participants.map((p, i) => ({
        userId: p.userId,
        teamId: p.teamId,
        score: p.currentScore,
        rank: i + 1,
        relaySegment: p.relaySegment,
        relayStatus: p.relayStatus,
      }));

      return res.json(ranking);
    } catch (error) {
      return res.status(500).json({ error: "取得排名失敗" });
    }
  });

  // 恢復卡住的倒數（server 重啟或前端未回報時使用）
  app.post("/api/matches/:matchId/recover", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const { matchId } = req.params;

      const [match] = await db.select()
        .from(gameMatches)
        .where(eq(gameMatches.id, matchId));

      if (!match) return res.status(404).json({ error: "對戰不存在" });

      if (match.status !== "countdown") {
        return res.status(400).json({ error: "對戰不在倒數狀態" });
      }

      // 檢查是否已超過倒數時間 + 2 秒容錯
      const settings = match.settings as MatchSettings | null;
      const countdownSeconds = settings?.countdownSeconds ?? 3;
      const elapsedMs = Date.now() - new Date(match.updatedAt).getTime();

      if (elapsedMs < (countdownSeconds + 2) * 1000) {
        return res.status(400).json({ error: "倒數尚未超時" });
      }

      const [updated] = await db.update(gameMatches)
        .set({ status: "playing", startedAt: new Date(), updatedAt: new Date() })
        .where(eq(gameMatches.id, matchId))
        .returning();

      ctx.broadcastToMatch(matchId, {
        type: "match_started",
        recovered: true,
        timestamp: new Date().toISOString(),
      });

      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "恢復對戰失敗" });
    }
  });

  // 註冊接力子路由
  registerRelayRoutes(app, ctx);
}
