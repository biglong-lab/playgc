// 對戰路由 (Matches) — 競賽 / 接力模式 API
//
// 🏁 2026-09-23 P1 接線（業主：「好，你看怎處理把功能完整」）
//   - 建立者自動參賽、設定從遊戲的 match_config 拍快照、邀請碼加入、重整找回自己的賽事
//   - 開賽 / 結束只有房主；倒數到期、時間到、全員完成由伺服器自己轉換（match-lifecycle 巡檢）
//   - 分數由遊戲進度自動同步（PATCH /api/sessions/:id/progress），不再收前端任意送的分數
import type { Express, Response } from "express";
import { z } from "zod";
import { isAuthenticated } from "../firebaseAuth";
import { storage } from "../storage";
import type { RouteContext, AuthenticatedRequest } from "./types";
import { matchActionLimiter } from "../utils/rate-limiters";
import { validateId } from "./utils";
import { registerRelayRoutes } from "./relay";
import { persistGuestDisplayName } from "../services/guest-display-name";
import {
  checkCanStart,
  countParticipants,
  createMatch,
  findMyActiveMatch,
  findWaitingMatchByCode,
  getMatch,
  isMatchParticipant,
  joinMatch,
  leaveMatch,
  listWaitingMatches,
  matchModeOf,
} from "../services/match-lobby";
import { getMatchDetail, getMyMatchState } from "../services/match-view";
import { beginCountdown, finishMatch, loadMatchRanking, promoteToPlaying } from "../services/match-lifecycle";

const playerNameBodySchema = z.object({ playerName: z.string().max(50).optional() }).passthrough();
const joinByCodeBodySchema = z.object({
  code: z.string().trim().min(4).max(10),
  playerName: z.string().max(50).optional(),
});

function userIdOf(req: AuthenticatedRequest, res: Response): string | null {
  const userId = req.user?.claims?.sub;
  if (!userId) res.status(401).json({ error: "未認證" });
  return userId ?? null;
}

/**
 * 訪客帶來的暱稱寫進 users（排名顯示用；正式帳號不覆寫）
 * 🔒 2026-09-23 安全審查 L1：跟場次一樣跑 validatePlayerName（長度 + 禁特殊字元），
 *   這個名字會出現在公開排名與 Telegram 通報
 */
async function rememberGuestName(req: AuthenticatedRequest, userId: string, name: string | undefined) {
  if (!name) return;
  const { validatePlayerName } = await import("@shared/lib/playerDisplay");
  const result = validatePlayerName(name);
  if (!result.valid) return;
  await persistGuestDisplayName(userId, result.value, req.user?.claims?.signInProvider);
}

export function registerMatchRoutes(app: Express, ctx: RouteContext) {
  registerLobbyRoutes(app, ctx);
  registerHostRoutes(app, ctx);
  registerReadRoutes(app);
  registerRelayRoutes(app, ctx);
}

/** 大廳：建立 / 列表 / 我的賽事 / 加入 / 邀請碼加入 / 離開 */
function registerLobbyRoutes(app: Express, ctx: RouteContext) {
  app.post("/api/games/:gameId/matches", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const game = await storage.getGame(req.params.gameId);
      if (!game) return res.status(404).json({ error: "遊戲不存在" });
      const mode = matchModeOf(game);
      if (!mode) return res.status(400).json({ error: "這款遊戲不是競賽或接力模式" });
      const body = playerNameBodySchema.safeParse(req.body ?? {});
      await rememberGuestName(req, userId, body.success ? body.data.playerName : undefined);
      const match = await createMatch(game, mode, userId);
      return res.status(201).json(match);
    } catch (error) {
      return res.status(500).json({ error: "建立對戰失敗" });
    }
  });

  app.get("/api/games/:gameId/matches", async (req, res) => {
    try {
      const gameId = validateId(req.params.gameId, res);
      if (!gameId) return;
      return res.json(await listWaitingMatches(gameId));
    } catch (error) {
      return res.status(500).json({ error: "取得對戰列表失敗" });
    }
  });

  app.get("/api/games/:gameId/matches/mine", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      return res.json(await findMyActiveMatch(req.params.gameId, userId));
    } catch (error) {
      return res.status(500).json({ error: "取得我的對戰失敗" });
    }
  });

  app.post("/api/games/:gameId/matches/join-by-code", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const body = joinByCodeBodySchema.safeParse(req.body ?? {});
      if (!body.success) return res.status(400).json({ error: "請輸入邀請碼" });
      const match = await findWaitingMatchByCode(req.params.gameId, body.data.code);
      if (!match) return res.status(404).json({ error: "找不到這個邀請碼的賽事（可能已開始或已結束）" });
      await rememberGuestName(req, userId, body.data.playerName);
      return respondJoin(res, ctx, match.id, userId);
    } catch (error) {
      return res.status(500).json({ error: "加入對戰失敗" });
    }
  });

  app.post("/api/matches/:matchId/join", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      const body = playerNameBodySchema.safeParse(req.body ?? {});
      await rememberGuestName(req, userId, body.success ? body.data.playerName : undefined);
      return respondJoin(res, ctx, matchId, userId);
    } catch (error) {
      return res.status(500).json({ error: "加入對戰失敗" });
    }
  });

  app.post("/api/matches/:matchId/leave", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const match = await getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      const result = await leaveMatch(match, userId);
      if (result === "not_waiting") return res.status(409).json({ error: "賽事已開始，不能退出" });
      ctx.broadcastToMatch(match.id, {
        type: result === "cancelled" ? "match_cancelled" : "match_participant_left",
        ranking: await loadMatchRanking(match.id),
        timestamp: new Date().toISOString(),
      });
      return res.json({ success: true, result });
    } catch (error) {
      return res.status(500).json({ error: "退出對戰失敗" });
    }
  });
}

async function respondJoin(res: Response, ctx: RouteContext, matchId: string, userId: string) {
  const result = await joinMatch(matchId, userId);
  if (!result.ok) return res.status(result.status).json({ error: result.message });
  if (!result.alreadyJoined) {
    ctx.broadcastToMatch(matchId, {
      type: "match_participant_joined",
      participantCount: result.participantCount,
      ranking: await loadMatchRanking(matchId),
      timestamp: new Date().toISOString(),
    });
  }
  return res.status(result.alreadyJoined ? 200 : 201).json({ ...result.participant, matchId });
}

/** 房主：開賽 / 結束；卡住的倒數補救 */
function registerHostRoutes(app: Express, ctx: RouteContext) {
  app.post("/api/matches/:matchId/start", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const match = await getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.creatorId !== userId) return res.status(403).json({ error: "forbidden", message: "只有房主可以開始對戰" });
      if (match.status !== "waiting") return res.status(409).json({ error: "對戰已開始或結束" });
      const reason = checkCanStart(match, await countParticipants(match.id));
      if (reason) return res.status(400).json({ error: reason });
      const updated = await beginCountdown(match, ctx.broadcastToMatch);
      if (!updated) return res.status(409).json({ error: "對戰已開始或結束" });
      return res.json(updated);
    } catch (error) {
      return res.status(500).json({ error: "開始對戰失敗" });
    }
  });

  app.post("/api/matches/:matchId/finish", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const match = await getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (match.creatorId !== userId) return res.status(403).json({ error: "forbidden", message: "只有房主可以結束對戰" });
      const finished = await finishMatch(match.id, ctx.broadcastToMatch, "host_ended");
      if (!finished) return res.status(409).json({ error: "對戰不在進行中" });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ error: "結束對戰失敗" });
    }
  });

  // 倒數卡住（伺服器重啟時計時器遺失）→ 參賽者可請求補做；巡檢 5 秒內也會自己補
  app.post("/api/matches/:matchId/recover", isAuthenticated, matchActionLimiter, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const match = await getMatch(req.params.matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      if (!(await isMatchParticipant(match.id, userId))) return res.status(403).json({ error: "forbidden", message: "你不是這場對戰的參賽者" });
      if (match.status !== "countdown") return res.status(400).json({ error: "對戰不在倒數狀態" });
      const countdownSeconds = (match.settings as { countdownSeconds?: number } | null)?.countdownSeconds ?? 3;
      if (Date.now() - new Date(match.updatedAt).getTime() < (countdownSeconds + 2) * 1000) {
        return res.status(400).json({ error: "倒數尚未超時" });
      }
      await promoteToPlaying(match.id, ctx.broadcastToMatch);
      return res.json(await getMatch(match.id));
    } catch (error) {
      return res.status(500).json({ error: "恢復對戰失敗" });
    }
  });

  // 🗑️ 2026-09-23：分數改由遊戲進度自動同步（沿用場次既有分數驗證），前端送分入口停用
  app.patch("/api/matches/:matchId/score", isAuthenticated, (_req, res) => {
    res.status(410).json({ error: "gone", message: "分數由遊戲進度自動同步，不需要另外回報" });
  });
}

/** 讀取：詳情 / 排名 / 我的狀態 */
function registerReadRoutes(app: Express) {
  app.get("/api/matches/:matchId", async (req, res) => {
    try {
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      const match = await getMatch(matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      return res.json(await getMatchDetail(match));
    } catch (error) {
      return res.status(500).json({ error: "取得對戰詳情失敗" });
    }
  });

  app.get("/api/matches/:matchId/ranking", async (req, res) => {
    try {
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      return res.json(await loadMatchRanking(matchId));
    } catch (error) {
      return res.status(500).json({ error: "取得排名失敗" });
    }
  });

  app.get("/api/matches/:matchId/me", isAuthenticated, async (req: AuthenticatedRequest, res) => {
    try {
      const userId = userIdOf(req, res);
      if (!userId) return;
      const matchId = validateId(req.params.matchId, res);
      if (!matchId) return;
      const match = await getMatch(matchId);
      if (!match) return res.status(404).json({ error: "對戰不存在" });
      return res.json(await getMyMatchState(match, userId));
    } catch (error) {
      return res.status(500).json({ error: "取得我的對戰狀態失敗" });
    }
  });
}
