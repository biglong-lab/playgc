// 🏁 賽事 API 回應型別（2026-09-23 P1；對應 server/services/match-view.ts、match-lobby.ts）
export type MatchStatus = "waiting" | "countdown" | "playing" | "finished" | "cancelled";

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

export interface RelayLeg {
  segment: number;
  fromPage: number;
  toPage: number;
}

export interface MatchDetail {
  id: string;
  gameId: string;
  matchMode: "competitive" | "relay";
  status: MatchStatus;
  accessCode: string | null;
  creatorId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  minParticipants: number;
  maxParticipants: number;
  countdownSeconds: number;
  timeLimitSeconds: number | null;
  ranking: MatchRankingEntry[];
  relayLegs: RelayLeg[];
  teamTotal: number | null;
}

export interface WaitingMatchSummary {
  id: string;
  accessCode: string | null;
  maxTeams: number | null;
  participantCount: number;
  createdAt: string;
}

export interface MyRelayLeg {
  status: "pending" | "active" | "completed" | "spectator";
  segment: number | null;
  totalSegments: number;
  fromPage: number | null;
  toPage: number | null;
  activeSegment: number | null;
}

export interface MyMatchState {
  matchId: string;
  gameId: string;
  matchMode: "competitive" | "relay";
  status: MatchStatus;
  isParticipant: boolean;
  sessionId: string | null;
  completed: boolean;
  myRank: number | null;
  myScore: number;
  participantCount: number;
  startedAt: string | null;
  timeLimitSeconds: number | null;
  relay: MyRelayLeg | null;
}

/** 剩餘秒數（不限時 = null；已超時 = 0） */
export function remainingSeconds(
  startedAt: string | null, timeLimitSeconds: number | null, now: number = Date.now(),
): number | null {
  if (!startedAt || !timeLimitSeconds) return null;
  const end = new Date(startedAt).getTime() + timeLimitSeconds * 1000;
  return Math.max(0, Math.ceil((end - now) / 1000));
}
