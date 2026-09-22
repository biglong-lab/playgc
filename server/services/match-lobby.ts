// 🏁 賽事大廳資料層（2026-09-23 P1 競賽 / 接力接線）
//
// 路由只做驗證與轉呼叫；賽事的建立 / 加入 / 離開 / 查詢集中在這裡。
// 設定來源：遊戲的 games.match_config（編輯器設定），建賽時拍快照到 game_matches.settings。
import { randomInt } from "crypto";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  gameMatches,
  matchParticipants,
  resolveMatchConfig,
  type Game,
  type GameMatch,
  type GameMatchConfig,
  type MatchParticipant,
  type MatchSettings,
} from "@shared/schema";
import { matchStartBlocker } from "@shared/lib/match-rules";

export type MatchMode = "competitive" | "relay";

const ACTIVE_STATUSES = ["waiting", "countdown", "playing"] as const;
/** 等待中超過這麼久沒開賽 → 不再列在大廳（避免舊房間堆積） */
const WAITING_LIST_WINDOW_MS = 6 * 60 * 60 * 1000;
const ACCESS_CODE_CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function matchModeOf(game: Pick<Game, "gameMode">): MatchMode | null {
  return game.gameMode === "competitive" || game.gameMode === "relay" ? game.gameMode : null;
}

/** 遊戲設定 → 賽事設定快照 */
export function buildMatchSettings(
  raw: GameMatchConfig | null | undefined,
  mode: MatchMode,
): { settings: MatchSettings; maxTeams: number } {
  const cfg = resolveMatchConfig(raw);
  const isRelay = mode === "relay";
  const legs = cfg.relaySegments;
  const settings: MatchSettings = {
    scoringMode: "combined",
    showRealTimeRanking: true,
    countdownSeconds: cfg.countdownSeconds,
    timeLimit: cfg.timeLimitMinutes > 0 ? cfg.timeLimitMinutes * 60 : undefined,
    minParticipants: isRelay ? legs.length : cfg.minParticipants,
    maxParticipants: isRelay ? legs.length : cfg.maxParticipants,
    ...(isRelay ? { relaySegments: legs } : {}),
  };
  return { settings, maxTeams: settings.maxParticipants ?? cfg.maxParticipants };
}

/** 開賽前檢查：回傳要顯示給房主的原因；可以開賽回 null（規則與大廳共用 shared/lib/match-rules） */
export function checkCanStart(match: Pick<GameMatch, "matchMode" | "settings">, participantCount: number): string | null {
  const s = match.settings as MatchSettings | null;
  return matchStartBlocker({
    matchMode: match.matchMode,
    participantCount,
    minParticipants: s?.minParticipants ?? 2,
    relayLegCount: s?.relaySegments?.length ?? 0,
  });
}

function randomAccessCode(): string {
  return Array.from({ length: 6 }, () => ACCESS_CODE_CHARSET[randomInt(ACCESS_CODE_CHARSET.length)]).join("");
}

/** 產生進行中賽事沒在用的邀請碼（碰撞就重抽，最多 5 次） */
async function generateAccessCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = randomAccessCode();
    const [taken] = await db
      .select({ id: gameMatches.id })
      .from(gameMatches)
      .where(and(eq(gameMatches.accessCode, code), inArray(gameMatches.status, [...ACTIVE_STATUSES])))
      .limit(1);
    if (!taken) return code;
  }
  return randomAccessCode();
}

/** 建立賽事，建立者自動成為第一位參賽者 */
export async function createMatch(game: Game, mode: MatchMode, userId: string): Promise<GameMatch> {
  const { settings, maxTeams } = buildMatchSettings(game.matchConfig as GameMatchConfig | null, mode);
  const accessCode = await generateAccessCode();
  return db.transaction(async (tx) => {
    const [match] = await tx
      .insert(gameMatches)
      .values({ gameId: game.id, creatorId: userId, matchMode: mode, status: "waiting", settings, maxTeams, accessCode })
      .returning();
    await tx.insert(matchParticipants).values({ matchId: match.id, userId, currentScore: 0 });
    return match;
  });
}

export async function getMatch(matchId: string): Promise<GameMatch | undefined> {
  const [match] = await db.select().from(gameMatches).where(eq(gameMatches.id, matchId));
  return match;
}

export async function getParticipant(matchId: string, userId: string): Promise<MatchParticipant | undefined> {
  const [p] = await db
    .select()
    .from(matchParticipants)
    .where(and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, userId)))
    .limit(1);
  return p;
}

export async function isMatchParticipant(matchId: string, userId: string): Promise<boolean> {
  return !!(await getParticipant(matchId, userId));
}

export async function countParticipants(matchId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(matchParticipants)
    .where(eq(matchParticipants.matchId, matchId));
  return row?.n ?? 0;
}

export interface WaitingMatchSummary {
  id: string;
  accessCode: string | null;
  maxTeams: number | null;
  participantCount: number;
  createdAt: Date;
}

/** 大廳列表：這款遊戲等待中的賽事（含目前人數） */
export async function listWaitingMatches(gameId: string): Promise<WaitingMatchSummary[]> {
  const since = new Date(Date.now() - WAITING_LIST_WINDOW_MS);
  return db
    .select({
      id: gameMatches.id,
      accessCode: gameMatches.accessCode,
      maxTeams: gameMatches.maxTeams,
      createdAt: gameMatches.createdAt,
      participantCount: sql<number>`count(${matchParticipants.id})::int`,
    })
    .from(gameMatches)
    .leftJoin(matchParticipants, eq(matchParticipants.matchId, gameMatches.id))
    .where(and(eq(gameMatches.gameId, gameId), eq(gameMatches.status, "waiting"), gt(gameMatches.createdAt, since)))
    .groupBy(gameMatches.id)
    .orderBy(desc(gameMatches.createdAt))
    .limit(20);
}

/** 我在這款遊戲還沒結束的賽事（重整 / 回到大廳時找回來） */
export async function findMyActiveMatch(gameId: string, userId: string): Promise<{ id: string; status: string } | null> {
  const [row] = await db
    .select({ id: gameMatches.id, status: gameMatches.status })
    .from(matchParticipants)
    .innerJoin(gameMatches, eq(gameMatches.id, matchParticipants.matchId))
    .where(and(
      eq(matchParticipants.userId, userId),
      eq(gameMatches.gameId, gameId),
      inArray(gameMatches.status, [...ACTIVE_STATUSES]),
    ))
    .orderBy(desc(gameMatches.createdAt))
    .limit(1);
  return row ?? null;
}

/** 用邀請碼找這款遊戲等待中的賽事（不分大小寫） */
export async function findWaitingMatchByCode(gameId: string, code: string): Promise<GameMatch | undefined> {
  const [match] = await db
    .select()
    .from(gameMatches)
    .where(and(
      eq(gameMatches.gameId, gameId),
      eq(gameMatches.accessCode, code.trim().toUpperCase()),
      eq(gameMatches.status, "waiting"),
    ))
    .orderBy(desc(gameMatches.createdAt))
    .limit(1);
  return match;
}

export type JoinResult =
  | { ok: true; participant: MatchParticipant; alreadyJoined: boolean; participantCount: number }
  | { ok: false; status: 400 | 404 | 409; message: string };

/** 加入賽事（鎖住賽事列避免同時加入超過人數；已加入 = 冪等成功） */
export async function joinMatch(matchId: string, userId: string): Promise<JoinResult> {
  return db.transaction(async (tx) => {
    const [match] = await tx.select().from(gameMatches).where(eq(gameMatches.id, matchId)).for("update");
    if (!match) return { ok: false, status: 404, message: "找不到這場賽事" };
    const rows = await tx.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
    const mine = rows.find((p) => p.userId === userId);
    if (mine) return { ok: true, participant: mine, alreadyJoined: true, participantCount: rows.length };
    if (match.status !== "waiting") return { ok: false, status: 409, message: "賽事已經開始或結束了" };
    if (match.maxTeams && rows.length >= match.maxTeams) return { ok: false, status: 409, message: "這場賽事人數已滿" };
    const [participant] = await tx.insert(matchParticipants).values({ matchId, userId, currentScore: 0 }).returning();
    return { ok: true, participant, alreadyJoined: false, participantCount: rows.length + 1 };
  });
}

/** 離開等待中的賽事：房主離開 = 取消整場；其他人 = 退出 */
export async function leaveMatch(match: GameMatch, userId: string): Promise<"cancelled" | "left" | "not_waiting"> {
  if (match.status !== "waiting") return "not_waiting";
  if (match.creatorId === userId) {
    await db
      .update(gameMatches)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(and(eq(gameMatches.id, match.id), eq(gameMatches.status, "waiting")));
    return "cancelled";
  }
  await db
    .delete(matchParticipants)
    .where(and(eq(matchParticipants.matchId, match.id), eq(matchParticipants.userId, userId)));
  return "left";
}
