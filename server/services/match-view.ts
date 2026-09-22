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
  creatorId: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  ranking: MatchRankingEntry[];
  relayLegs: RelayLeg[];
  /** 接力：整隊總分（各棒加總）；競賽 = null */
  teamTotal: number | null;
}

export async function getMatchDetail(match: GameMatch): Promise<MatchDetailView> {
  const ranking = await loadMatchRanking(match.id);
  const isRelay = match.matchMode === "relay";
  return {
    id: match.id,
    gameId: match.gameId,
    matchMode: match.matchMode,
    status: match.status,
    accessCode: match.accessCode,
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
