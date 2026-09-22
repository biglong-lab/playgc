// 🏁 遊戲頁的賽事閘門（2026-09-23 P1 競賽 / 接力接線）
//
// 網址沒帶 ?match= → 直接顯示遊戲（一般單人 / 組隊完全不受影響）
// 帶 ?match= →
//   - 不是參賽者 / 還在等待或倒數 / 已結束 → 回賽事大廳（大廳負責倒數與結算畫面）
//   - 接力還沒輪到我 / 我已完成 → 等待畫面（即時排名、接力進度）
//   - 輪到我 / 競賽進行中 → 顯示遊戲 + 右上角賽事看板（剩餘時間 / 名次）
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useMatchWebSocket } from "@/hooks/use-match-websocket";
import { queryClient } from "@/lib/queryClient";
import { GAME_COMPLETED_EVENT } from "@/lib/play-routes";
import { FullscreenSpinner } from "@/components/shared/GuestGate";
import { isScoringEnabled } from "@shared/lib/scoring";
import type { Game } from "@shared/schema";
import type { MyMatchState } from "@/lib/match-types";
import { MatchPlayProvider } from "./MatchPlayContext";
import { playInfoOf, resolvePlayPhase, type MatchPlayInfo } from "./play-phase";
import MatchHud from "./MatchHud";
import MatchWaitingScreen from "./MatchWaitingScreen";

export default function MatchPlayGate({ children }: { children: ReactNode }) {
  const search = useSearch();
  const matchId = useMemo(() => new URLSearchParams(search).get("match"), [search]);
  if (!matchId) return <>{children}</>;
  return <MatchPlayGateInner matchId={matchId}>{children}</MatchPlayGateInner>;
}

/** 我的賽事狀態：輪詢 + WS 事件 / 本局完成時立刻重抓 */
function useMyMatchState(matchId: string) {
  const queryKey = useMemo(() => ["/api/matches", matchId, "me"], [matchId]);
  const ws = useMatchWebSocket(matchId);
  const query = useQuery<MyMatchState>({ queryKey, refetchInterval: 3000 });
  useEffect(() => {
    if (ws.lastEvent) queryClient.invalidateQueries({ queryKey });
  }, [ws.lastEvent, queryKey]);
  useEffect(() => {
    const refresh = () => queryClient.invalidateQueries({ queryKey });
    window.addEventListener(GAME_COMPLETED_EVENT, refresh);
    return () => window.removeEventListener(GAME_COMPLETED_EVENT, refresh);
  }, [queryKey]);
  return query;
}

/** 接力：從等待切到輪到我 → 震動提醒（手機放口袋也知道） */
function useTurnBuzz(isMyTurn: boolean) {
  const wasWaitingRef = useRef(false);
  useEffect(() => {
    if (!isMyTurn) {
      wasWaitingRef.current = true;
      return;
    }
    if (wasWaitingRef.current) navigator.vibrate?.([200, 100, 200]);
    wasWaitingRef.current = false;
  }, [isMyTurn]);
}

function MatchPlayGateInner({ matchId, children }: { matchId: string; children: ReactNode }) {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const link = useFieldLink();
  const { user, firebaseUser } = useAuth();
  const { data: me, isError, isFetchedAfterMount } = useMyMatchState(matchId);
  const { data: game } = useQuery<Game>({ queryKey: ["/api/games", gameId] });
  // 一時連不上（已有資料）→ 沿用上一份狀態繼續玩，不把玩家踢出遊戲；第一次就拿不到才回大廳
  const phase = isError && !me ? "to_lobby" : resolvePlayPhase(me);
  // 每 3 秒輪詢都會拿到新物件 → 以內容當 key，內容沒變就沿用同一份（遊戲頁不用重算頁面）
  const infoKey = me ? JSON.stringify(playInfoOf(me)) : null;
  const info = useMemo<MatchPlayInfo | null>(() => (infoKey ? JSON.parse(infoKey) : null), [infoKey]);
  useTurnBuzz(phase === "play");

  // 🐛 回大廳只看「這次進頁面後重新抓到」的狀態，並清掉大廳那份快取：
  //   否則大廳拿到舊快取（進行中）又導回遊戲、遊戲拿到舊快取（已結束）又導回大廳 → 無限來回
  const shouldLeave = phase === "to_lobby" && (isFetchedAfterMount || isError);
  useEffect(() => {
    if (!shouldLeave) return;
    queryClient.removeQueries({ queryKey: ["/api/matches", matchId], exact: true });
    setLocation(link(`/match/${gameId}?m=${matchId}`), { replace: true });
  }, [shouldLeave, gameId, matchId, link, setLocation]);

  if (!me || phase === "loading" || phase === "to_lobby") return <FullscreenSpinner label="載入賽事中..." />;
  if (phase !== "play" || !info) {
    return <MatchWaitingScreen me={me} userId={firebaseUser?.uid ?? user?.id} showScore={isScoringEnabled(game)} />;
  }
  return (
    <MatchPlayProvider value={info}>
      <MatchHud me={me} />
      {children}
    </MatchPlayProvider>
  );
}
