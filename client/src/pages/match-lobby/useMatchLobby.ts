// 對戰大廳邏輯 Hook
//
// 🏁 2026-09-23 P1 重寫（業主：「好，你看怎處理把功能完整」）
//   - 賽事 ID 進網址（?m=）：重整 / 回到大廳找得回自己的賽事；沒帶就查「我進行中的賽事」
//   - 分享連結帶 ?code=：朋友點開自動加入
//   - 開賽 / 倒數 / 結算由伺服器控制；大廳輪詢 + WS 事件加速更新
//   - 開賽後參賽者自動導到遊戲頁（/game/:id?match=）
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useAuth } from "@/hooks/useAuth";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { queryClient } from "@/lib/queryClient";
import { parseInviteCode } from "@/lib/invite-code";
import type { MatchDetail, WaitingMatchSummary } from "@/lib/match-types";
import type { Game } from "@shared/schema";
import { isParticipantOf, resolveLobbyView } from "./lobby-status";
import { useMatchActions } from "./useMatchActions";

export type { MatchLobbyView } from "./lobby-status";

const ENDED = new Set(["finished", "cancelled"]);

/** 目前這場賽事：網址 ?m= 優先；沒有就找「我進行中的賽事」並寫回網址 */
function useCurrentMatchId(gameId: string | undefined, userId: string | undefined) {
  const search = useSearch();
  const urlMatchId = useMemo(() => new URLSearchParams(search).get("m"), [search]);
  const inviteCode = useMemo(() => parseInviteCode(search), [search]);
  const mine = useQuery<{ id: string; status: string } | null>({
    queryKey: ["/api/games", gameId, "matches", "mine"],
    enabled: !!gameId && !!userId && !urlMatchId,
  });
  return { urlMatchId, inviteCode, matchId: urlMatchId ?? mine.data?.id ?? null, isResolving: !urlMatchId && mine.isLoading };
}

function useMatchDetail(matchId: string | null, lastEvent: unknown) {
  const detail = useQuery<MatchDetail>({
    queryKey: ["/api/matches", matchId],
    enabled: !!matchId,
    refetchInterval: (q) => (q.state.data && ENDED.has(q.state.data.status) ? false : 3000),
  });
  // WS 有事件（加入 / 倒數 / 開賽 / 排名 / 結算）→ 立刻重抓，不用等輪詢
  useEffect(() => {
    if (matchId && lastEvent) queryClient.invalidateQueries({ queryKey: ["/api/matches", matchId] });
  }, [matchId, lastEvent]);
  // isFresh：這次進大廳後重新抓過（導向遊戲只信這份，不信別頁留下的舊快取）
  return { data: detail.data, isFresh: detail.isFetchedAfterMount };
}

export function useMatchLobby() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();
  const { user, firebaseUser, isLoading: authLoading } = useAuth();
  const currentUserId = firebaseUser?.uid ?? user?.id;
  const lobbyPath = link(`/match/${gameId}`);

  const { urlMatchId, inviteCode, matchId, isResolving } = useCurrentMatchId(gameId, currentUserId);
  const ws = useMatchWebSocket(matchId);
  const { data: currentMatch, isFresh } = useMatchDetail(matchId, ws.lastEvent);

  const { data: game, isLoading: gameLoading } = useQuery<Game>({ queryKey: ["/api/games", gameId] });
  const { data: matches } = useQuery<WaitingMatchSummary[]>({
    queryKey: ["/api/games", gameId, "matches"],
    enabled: !!gameId && !matchId,
    refetchInterval: 5000,
  });

  const enterMatch = useCallback(
    (id: string) => setLocation(`${lobbyPath}?m=${id}`, { replace: true }),
    [lobbyPath, setLocation],
  );
  const backToList = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "matches", "mine"] });
    setLocation(lobbyPath, { replace: true });
  }, [gameId, lobbyPath, setLocation]);

  const actions = useMatchActions({
    gameId, matchId, isGuest: !!firebaseUser?.isAnonymous, onEnterMatch: enterMatch, onLeftMatch: backToList,
  });

  useSyncMatchIdToUrl(urlMatchId, matchId, enterMatch);
  useAutoJoinByCode(inviteCode, currentUserId, urlMatchId, actions.joinByCode.mutate);

  const currentView = resolveLobbyView({
    isLoading: authLoading || gameLoading || isResolving,
    matchId,
    detail: currentMatch,
    wsStatus: ws.matchStatus,
  });
  const isParticipant = isParticipantOf(currentMatch, currentUserId);
  useRedirectToGame(currentView === "playing" && isParticipant && isFresh, matchId, gameId, link, setLocation);

  return {
    gameId, game, user, lobbyPath,
    matches: matches ?? [],
    currentMatch, currentMatchId: matchId, currentView, ws,
    isLoading: authLoading || gameLoading,
    isCreator: !!currentMatch && currentMatch.creatorId === currentUserId,
    isParticipant, currentUserId,
    createMatch: () => actions.create.mutate(),
    joinMatch: actions.join.mutate,
    joinByCode: actions.joinByCode.mutate,
    startMatch: () => actions.start.mutate(),
    finishMatch: () => actions.finish.mutate(),
    leaveMatch: () => actions.leave.mutate(),
    playAnother: backToList,
    isCreating: actions.create.isPending,
    isJoining: actions.join.isPending || actions.joinByCode.isPending,
    isStarting: actions.start.isPending,
    isLeaving: actions.leave.isPending,
    handleGoBack: () => setLocation(link("/home")),
  };
}

/** 從「我進行中的賽事」找到的 ID 寫回網址（之後重整、分享都穩定） */
function useSyncMatchIdToUrl(urlMatchId: string | null, matchId: string | null, enterMatch: (id: string) => void) {
  useEffect(() => {
    if (!urlMatchId && matchId) enterMatch(matchId);
  }, [urlMatchId, matchId, enterMatch]);
}

/** 分享連結 ?code= → 自動加入一次（已經在某場賽事就不動） */
function useAutoJoinByCode(
  code: string, userId: string | undefined, urlMatchId: string | null, joinByCode: (code: string) => void,
) {
  const triedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!code || !userId || urlMatchId || triedRef.current === code) return;
    triedRef.current = code;
    joinByCode(code);
  }, [code, userId, urlMatchId, joinByCode]);
}

/**
 * 🐛 開賽後導向遊戲頁：之前 playing 只顯示排名、從不導向 → 競賽／接力玩家看不到任何關卡
 *   只導參賽者（旁觀者留在大廳看排名）；ref 防重複導向
 */
function useRedirectToGame(
  shouldRedirect: boolean, matchId: string | null, gameId: string | undefined,
  link: (path: string) => string, setLocation: (to: string, opts?: { replace?: boolean }) => void,
) {
  const redirectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!shouldRedirect || !matchId || !gameId || redirectedRef.current === matchId) return;
    redirectedRef.current = matchId;
    setLocation(link(`/game/${gameId}?match=${matchId}`));
  }, [shouldRedirect, matchId, gameId, link, setLocation]);
}
