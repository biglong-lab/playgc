// 🏁 賽事生命週期（2026-09-23 競賽 / 接力補完整）
//
// 業主：「好，你看怎處理把功能完整」— 競賽個人制先完整走一輪
// 原本：倒數由前端回報、結束要有人手動呼叫（且任何人都能結束）、分數 API 前端從沒呼叫
// 現在：
//   - 伺服器控制：倒數到 → 開賽；時間到 / 全員完成 / 房主結束 → 結算
//   - 分數來源：玩家的遊戲場次進度（PATCH /api/sessions/:id/progress）自動同步，
//     沿用場次既有的分數驗證，不另開前端可任意呼叫的計分入口
//   - 巡檢：每 5 秒掃進行中的賽事（重啟後也能補做到期的狀態轉換；單 worker 架構）
import { and, asc, eq, inArray, isNull, lt } from "drizzle-orm";
import { db } from "../db";
import { gameMatches, gameSessions, matchParticipants, pages, users, type GameMatch, type MatchSettings } from "@shared/schema";
import { getPlayerDisplayName } from "@shared/lib/playerDisplay";
import { MAX_SESSION_SCORE } from "../lib/scoreValidation";

export type MatchBroadcast = (matchId: string, message: { type: string; [key: string]: unknown }) => void;

export interface MatchRankingEntry {
  participantId: string;
  userId: string | null;
  displayName: string;
  score: number;
  rank: number;
  completed: boolean;
  relaySegment: number | null;
  relayStatus: string | null;
}

/** 進行中超過這個時間仍沒結束（未設時限、玩家都離開）→ 自動結算，避免永遠卡在進行中 */
const MAX_PLAYING_MS = 6 * 60 * 60 * 1000;

interface RankableParticipant {
  currentScore: number;
  completedAt: Date | null;
}

/** 排名：分數高者先；同分時先完成者先（未完成視為最晚） */
export function rankParticipants<T extends RankableParticipant>(list: T[]): Array<T & { rank: number }> {
  const doneAt = (p: RankableParticipant) => (p.completedAt ? new Date(p.completedAt).getTime() : Number.POSITIVE_INFINITY);
  return [...list]
    .sort((a, b) => b.currentScore - a.currentScore || doneAt(a) - doneAt(b))
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

/** 內部用：多帶綁定的場次 ID（不對外廣播，避免別人拿到你的場次 ID） */
export interface MatchRankingRow extends MatchRankingEntry {
  sessionId: string | null;
}

/** 目前排名（含顯示名：真名 > 信箱前綴 > 場次暱稱 > 玩家） */
export async function loadMatchRankingRows(matchId: string): Promise<MatchRankingRow[]> {
  const rows = await db
    .select({
      p: matchParticipants,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      playerName: gameSessions.playerName,
    })
    .from(matchParticipants)
    .leftJoin(users, eq(users.id, matchParticipants.userId))
    .leftJoin(gameSessions, eq(gameSessions.id, matchParticipants.sessionId))
    .where(eq(matchParticipants.matchId, matchId));

  const ranked = rankParticipants(rows.map((r) => ({ ...r.p, source: r })));
  return ranked.map((p) => ({
    participantId: p.id,
    userId: p.userId,
    sessionId: p.sessionId,
    // 🔒 2026-09-23 安全審查 M2：不傳 email → 顯示名不會退化成信箱前綴（排名是公開端點）
    displayName: getPlayerDisplayName({
      firstName: p.source.firstName,
      lastName: p.source.lastName,
      playerName: p.source.playerName,
    }),
    score: p.currentScore,
    rank: p.rank,
    completed: !!p.completedAt,
    relaySegment: p.relaySegment,
    relayStatus: p.relayStatus,
  }));
}

/** 對外排名（大廳 / 廣播） */
export async function loadMatchRanking(matchId: string): Promise<MatchRankingEntry[]> {
  const rows = await loadMatchRankingRows(matchId);
  return rows.map(({ sessionId: _sessionId, ...entry }) => entry);
}

async function broadcastRanking(matchId: string, broadcast: MatchBroadcast): Promise<void> {
  broadcast(matchId, { type: "match_ranking", ranking: await loadMatchRanking(matchId), timestamp: new Date().toISOString() });
}

function settingsOf(match: GameMatch): MatchSettings | null {
  return match.settings as MatchSettings | null;
}

/** 等待中 → 倒數（只有 waiting 能轉，冪等） */
export async function beginCountdown(match: GameMatch, broadcast: MatchBroadcast): Promise<GameMatch | null> {
  const [updated] = await db
    .update(gameMatches)
    .set({ status: "countdown", updatedAt: new Date() })
    .where(and(eq(gameMatches.id, match.id), eq(gameMatches.status, "waiting")))
    .returning();
  if (!updated) return null;
  const seconds = settingsOf(updated)?.countdownSeconds ?? 3;
  broadcast(match.id, { type: "match_countdown", seconds, timestamp: new Date().toISOString() });
  setTimeout(() => {
    void promoteToPlaying(match.id, broadcast).catch((err) => console.error("[match] 開賽失敗:", err));
  }, seconds * 1000 + 50).unref?.();
  return updated;
}

/** 倒數 → 進行中（只有 countdown 能轉，冪等；前端回報 / 計時器 / 巡檢 誰先到都一樣） */
export async function promoteToPlaying(matchId: string, broadcast: MatchBroadcast): Promise<boolean> {
  const now = new Date();
  const [m] = await db
    .update(gameMatches)
    .set({ status: "playing", startedAt: now, updatedAt: now })
    .where(and(eq(gameMatches.id, matchId), eq(gameMatches.status, "countdown")))
    .returning();
  if (!m) return false;
  if (m.matchMode === "relay") {
    const { activateFirstRelayLeg } = await import("./relay-lifecycle");
    await activateFirstRelayLeg(matchId);
  }
  broadcast(matchId, {
    type: "match_started",
    startedAt: now.toISOString(),
    timeLimit: settingsOf(m)?.timeLimit ?? null,
    timestamp: now.toISOString(),
  });
  return true;
}

/** 進行中 → 結算（只有 playing 能轉，冪等）；寫入最終名次並廣播 */
export async function finishMatch(matchId: string, broadcast: MatchBroadcast, reason: string): Promise<boolean> {
  const now = new Date();
  const [m] = await db
    .update(gameMatches)
    .set({ status: "finished", finishedAt: now, updatedAt: now })
    .where(and(eq(gameMatches.id, matchId), eq(gameMatches.status, "playing")))
    .returning();
  if (!m) return false;
  const ranking = await loadMatchRanking(matchId);
  await Promise.all(
    ranking.map((r) =>
      db.update(matchParticipants).set({ finalScore: r.score, finalRank: r.rank }).where(eq(matchParticipants.id, r.participantId)),
    ),
  );
  broadcast(matchId, { type: "match_finished", reason, ranking, timestamp: now.toISOString() });
  return true;
}

function isDue(match: GameMatch, now: number): "start" | "finish" | null {
  const s = settingsOf(match);
  if (match.status === "countdown") {
    return now >= new Date(match.updatedAt).getTime() + (s?.countdownSeconds ?? 3) * 1000 ? "start" : null;
  }
  if (match.status !== "playing" || !match.startedAt) return null;
  const startedAt = new Date(match.startedAt).getTime();
  const limitMs = s?.timeLimit ? s.timeLimit * 1000 : MAX_PLAYING_MS;
  return now >= startedAt + limitMs ? "finish" : null;
}

/** 一次巡檢最多處理幾場（🔒 安全審查 M4：原本沒有上限，堆出幾千場會變成持續性 DB 負載） */
const SWEEP_BATCH = 200;
/** 開了卻沒人開賽的房間，超過這個時間自動取消（避免等待中賽事無限累積） */
const STALE_WAITING_MS = 6 * 60 * 60 * 1000;

/** 巡檢：到期的倒數開賽、到期的賽事結算、過期沒開賽的房間取消 */
export async function advanceDueMatches(broadcast: MatchBroadcast): Promise<void> {
  const active = await db
    .select()
    .from(gameMatches)
    .where(inArray(gameMatches.status, ["countdown", "playing"]))
    .orderBy(asc(gameMatches.updatedAt))
    .limit(SWEEP_BATCH);
  const now = Date.now();
  for (const m of active) {
    const due = isDue(m, now);
    if (due === "start") await promoteToPlaying(m.id, broadcast);
    if (due === "finish") await finishMatch(m.id, broadcast, "time_up");
  }
  await cancelStaleWaitingMatches(new Date(now - STALE_WAITING_MS));
}

/** 太久沒開賽的等待中賽事 → 取消（只改狀態，不刪資料） */
async function cancelStaleWaitingMatches(before: Date): Promise<void> {
  await db
    .update(gameMatches)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(and(eq(gameMatches.status, "waiting"), lt(gameMatches.updatedAt, before)));
}

let sweeper: ReturnType<typeof setInterval> | null = null;

export function startMatchSweeper(broadcast: MatchBroadcast, intervalMs = 5000): void {
  if (sweeper) return;
  let running = false;
  sweeper = setInterval(() => {
    if (running) return;
    running = true;
    advanceDueMatches(broadcast)
      .catch((err) => console.error("[match] 巡檢失敗:", err))
      .finally(() => { running = false; });
  }, intervalMs);
  sweeper.unref?.();
}

async function findPlayingParticipant(sessionId: string, userId: string) {
  const [row] = await db
    .select({ p: matchParticipants, status: gameMatches.status, matchMode: gameMatches.matchMode })
    .from(matchParticipants)
    .innerJoin(gameMatches, eq(gameMatches.id, matchParticipants.matchId))
    .where(and(eq(matchParticipants.userId, userId), eq(matchParticipants.sessionId, sessionId)))
    .limit(1);
  return row && row.status === "playing" ? row : null;
}

/**
 * 接力：這一頁是不是自己那一棒負責的頁碼（沒帶 pageId 視為通過 — 進度更新不一定帶頁）
 * 🔒 2026-09-23 安全審查 M5：伺服器自己查頁碼，不信前端只送自己那段
 */
async function isPageInMyLeg(matchId: string, segment: number | null, pageId?: string): Promise<boolean> {
  if (!pageId || !segment) return !pageId;
  const [match] = await db.select({ settings: gameMatches.settings }).from(gameMatches).where(eq(gameMatches.id, matchId));
  const leg = (match?.settings as MatchSettings | null)?.relaySegments?.[segment - 1];
  if (!leg) return false;
  const [page] = await db.select({ pageOrder: pages.pageOrder }).from(pages).where(eq(pages.id, pageId));
  if (!page) return false;
  return page.pageOrder >= leg.fromPage && page.pageOrder <= leg.toPage;
}

/** 這個場次是不是進行中接力賽的一棒（只玩部分頁面 → 不寫個人排行榜 / 成就） */
export async function isRelayLegSession(sessionId: string, userId: string): Promise<boolean> {
  const row = await findPlayingParticipant(sessionId, userId);
  return row?.matchMode === "relay";
}

/** 玩家遊戲場次開局時綁定到賽事（只綁一次；賽事需進行中、本人需為參賽者） */
export async function linkMatchSession(matchId: string, userId: string, sessionId: string): Promise<boolean> {
  const [match] = await db.select({ status: gameMatches.status }).from(gameMatches).where(eq(gameMatches.id, matchId));
  if (match?.status !== "playing") return false;
  const linked = await db
    .update(matchParticipants)
    .set({ sessionId })
    .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId), isNull(matchParticipants.sessionId)))
    .returning({ id: matchParticipants.id });
  return linked.length > 0;
}

/**
 * 遊戲進度更新 → 同步賽事分數（只增不減）並廣播排名
 * 🔒 2026-09-23 安全審查 H2：進度分數要跑場次既有的分數驗證（硬上限 + 射擊紀錄比對 + 可疑紀錄），
 *   否則玩家直接 PATCH 進度灌 10000 分、時間到就以灌的分數結算。
 *   只有「這個場次真的在某場進行中的賽事裡」才驗，一般單人 / 組隊場次不增加額外查詢。
 */
export async function syncMatchScoreFromSession(
  sessionId: string, userId: string, score: number, broadcast: MatchBroadcast, pageId?: string,
): Promise<void> {
  const row = await findPlayingParticipant(sessionId, userId);
  if (!row) return;
  // 接力：不是自己那一棒的時段不收分（防非當棒玩家先偷跑刷分）
  if (row.matchMode === "relay" && row.p.relayStatus !== "active") return;
  // 接力：分數只收自己那一段的頁面（🔒 安全審查 M5：原本只有前端自律）
  if (row.matchMode === "relay" && !(await isPageInMyLeg(row.p.matchId, row.p.relaySegment, pageId))) return;
  const { validateSessionScore } = await import("../lib/scoreValidation");
  const { safeScore } = await validateSessionScore({ sessionId, userId, clientScore: score, source: "session-progress" });
  const capped = Math.min(safeScore, MAX_SESSION_SCORE);
  if (capped <= row.p.currentScore) return;
  await db.update(matchParticipants).set({ currentScore: capped }).where(eq(matchParticipants.id, row.p.id));
  await broadcastRanking(row.p.matchId, broadcast);
}

/**
 * 遊戲場次完成 → 標記參賽者完成；全員完成就結算
 * finalScore 是場次完成時經 validateSessionScore 修正過的分數 → 以它為準（蓋掉進度途中的暫存分數）
 */
export async function completeMatchParticipant(
  sessionId: string, userId: string, finalScore: number, broadcast: MatchBroadcast,
): Promise<void> {
  const row = await findPlayingParticipant(sessionId, userId);
  if (!row || row.p.completedAt) return;
  // 接力：只有當棒的人完成才算（防還沒輪到的人先把整場跑完觸發交棒）
  if (row.matchMode === "relay" && row.p.relayStatus !== "active") return;
  await db
    .update(matchParticipants)
    .set({ currentScore: Math.max(0, Math.min(finalScore, MAX_SESSION_SCORE)), completedAt: new Date() })
    .where(eq(matchParticipants.id, row.p.id));

  if (row.matchMode === "relay") {
    const { handoffAfterLeg } = await import("./relay-lifecycle");
    await handoffAfterLeg(row.p.matchId, row.p.id, broadcast);
    return;
  }
  const remaining = await db
    .select({ id: matchParticipants.id })
    .from(matchParticipants)
    .where(and(eq(matchParticipants.matchId, row.p.matchId), isNull(matchParticipants.completedAt)))
    .limit(1);
  if (remaining.length === 0) await finishMatch(row.p.matchId, broadcast, "all_completed");
  else await broadcastRanking(row.p.matchId, broadcast);
}
