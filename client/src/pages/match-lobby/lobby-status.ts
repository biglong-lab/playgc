// 🏁 賽事大廳畫面判斷（純函式，2026-09-23 P1）
import type { MatchDetail, MatchStatus } from "@/lib/match-types";

export type MatchLobbyView =
  | "loading" | "browse" | "waiting" | "countdown" | "playing" | "finished" | "cancelled";

const PROGRESS: Record<string, number> = { waiting: 0, countdown: 1, playing: 2, finished: 3 };

/**
 * 以「走得比較前面」的狀態為準：WS 事件通常比輪詢快一步（倒數 / 開賽），
 * 但輪詢是 DB 真相（重整、斷線回來）→ 兩者取進度較後者，狀態永遠不會倒退
 */
export function resolveMatchStatus(detailStatus: MatchStatus, wsStatus: string | null): MatchStatus {
  if (detailStatus === "cancelled") return "cancelled";
  if (!wsStatus || !(wsStatus in PROGRESS)) return detailStatus;
  return (PROGRESS[wsStatus] ?? 0) > (PROGRESS[detailStatus] ?? 0) ? (wsStatus as MatchStatus) : detailStatus;
}

export function resolveLobbyView(input: {
  isLoading: boolean;
  matchId: string | null;
  detail: MatchDetail | undefined;
  wsStatus: string | null;
}): MatchLobbyView {
  if (input.isLoading) return "loading";
  if (!input.matchId) return "browse";
  if (!input.detail) return "loading";
  return resolveMatchStatus(input.detail.status, input.wsStatus);
}

/** 我是不是這場的參賽者（大廳只幫參賽者自動導向遊戲，旁觀者留在排名畫面，避免來回跳轉） */
export function isParticipantOf(detail: MatchDetail | undefined, userId: string | undefined): boolean {
  return !!userId && !!detail?.ranking.some((r) => r.userId === userId);
}

/** 分享連結：帶 ?code= 讓朋友點開直接加入 */
export function buildMatchInviteUrl(origin: string, lobbyPath: string, accessCode: string): string {
  return `${origin}${lobbyPath}?code=${encodeURIComponent(accessCode)}`;
}
