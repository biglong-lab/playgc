// 🏁 賽事對外檢視（2026-09-23 P1）：大廳詳情 / 遊戲中「我的賽事狀態」
import type { GameMatch, MatchSettings } from "@shared/schema";
import { loadMatchRanking, loadMatchRankingRows, type MatchRankingEntry } from "./match-lifecycle";
import { getMyRelayLeg, relayLegsOf, type MyRelayLeg, type RelayLeg } from "./relay-lifecycle";

export interface MatchConfigView {
  minParticipants: number;
  maxParticipants: number;
  countdownSeconds: number;
  /** null = 不限時 */
  timeLimitSeconds: number | null;
}

export function matchConfigView(match: Pick<GameMatch, "settings" | "maxTeams">): MatchConfigView {
  const s = match.settings as MatchSettings | null;
  return {
    minParticipants: s?.minParticipants ?? 2,
    maxParticipants: s?.maxParticipants ?? match.maxTeams ?? 10,
    countdownSeconds: s?.countdownSeconds ?? 3,
    timeLimitSeconds: s?.timeLimit ?? null,
  };
}

export interface MatchDetailView extends MatchConfigView {
  id: string;
  gameId: string;
  matchMode: string;
  status: string;
  accessCode: string | null;
  /** 私人房：不出現在公開列表 */
  isPrivate: boolean;
  creatorId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  ranking: MatchRankingEntry[];
  relayLegs: RelayLeg[];
  /** 接力：整隊總分（各棒加總）；競賽 = null */
  teamTotal: number | null;
}

/**
 * 賽事詳情
 * 🔒 2026-09-23 安全審查 M1：accessCode 只回給房主 / 已加入的人（viewerId）；
 *   其他人（含未登入）看得到賽況與排名，但拿不到邀請碼
 */
export async function getMatchDetail(match: GameMatch, viewerId?: string): Promise<MatchDetailView> {
  const ranking = await loadMatchRanking(match.id);
  const isRelay = match.matchMode === "relay";
  const canSeeCode = !!viewerId && (viewerId === match.creatorId || ranking.some((r) => r.userId === viewerId));
  return {
    id: match.id,
    gameId: match.gameId,
    matchMode: match.matchMode,
    status: match.status,
    accessCode: canSeeCode ? match.accessCode : null,
    isPrivate: !!(match.settings as MatchSettings | null)?.isPrivate,
    creatorId: match.creatorId,
    startedAt: match.startedAt,
    finishedAt: match.finishedAt,
    ...matchConfigView(match),
    ranking,
    relayLegs: isRelay ? relayLegsOf(match) : [],
    teamTotal: isRelay ? ranking.reduce((sum, r) => sum + r.score, 0) : null,
  };
}

export interface MyMatchState {
  matchId: string;
  gameId: string;
  matchMode: string;
  status: string;
  isParticipant: boolean;
  /** 已綁定的遊戲場次（重整回來接續用）；還沒開局 = null */
  sessionId: string | null;
  completed: boolean;
  myRank: number | null;
  myScore: number;
  participantCount: number;
  startedAt: Date | null;
  timeLimitSeconds: number | null;
  relay: MyRelayLeg | null;
}

/** 遊戲中用：我在這場賽事的狀態（等待畫面 / 計時 / 名次 / 接力棒次） */
export async function getMyMatchState(match: GameMatch, userId: string): Promise<MyMatchState> {
  const ranking = await loadMatchRankingRows(match.id);
  const mine = ranking.find((r) => r.userId === userId);
  return {
    matchId: match.id,
    gameId: match.gameId,
    matchMode: match.matchMode,
    status: match.status,
    isParticipant: !!mine,
    sessionId: mine?.sessionId ?? null,
    completed: mine?.completed ?? false,
    myRank: mine?.rank ?? null,
    myScore: mine?.score ?? 0,
    participantCount: ranking.length,
    startedAt: match.startedAt,
    timeLimitSeconds: matchConfigView(match).timeLimitSeconds,
    relay: mine ? await getMyRelayLeg(match, userId) : null,
  };
}
