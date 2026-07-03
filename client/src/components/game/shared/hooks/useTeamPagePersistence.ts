// 🗂️ useTeamPagePersistence — L0→L3 升級捷徑 hook（2026-05-05）
//
// 給 CollectiveScore、RoleAssign、QuestChain、JigsawPuzzle、TreasureHunt、GpsCascade 用
// 自動拉 my-team，然後委由 useTeamGameState 做 DB 持久化
//
// 使用方式：
//   const { state, updateState, handleWsMessage, isLoaded, teamId } =
//     useTeamPagePersistence<MyState>({ gameId, sessionId, pageId, type, defaultState });

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { useTeamGameState, type UseTeamGameStateResult } from "./useTeamGameState";

interface MyTeamResponse {
  id: string;
}

interface UseTeamPagePersistenceOptions<T> {
  gameId: string;
  sessionId: string;
  pageId: string;
  type: string;
  defaultState: T;
}

export interface UseTeamPagePersistenceResult<T> extends UseTeamGameStateResult<T> {
  teamId: string | undefined;
  userId: string | undefined;
}

export function useTeamPagePersistence<T extends Record<string, unknown>>({
  gameId,
  sessionId,
  pageId,
  type,
  defaultState,
}: UseTeamPagePersistenceOptions<T>): UseTeamPagePersistenceResult<T> {
  const { user } = useAuth();

  const { data: myTeam } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });

  const teamId = myTeam?.id;
  const userId = user?.id;

  const gameState = useTeamGameState<T>({
    teamId,
    sessionId,
    pageId,
    type,
    defaultState,
    enabled: !!teamId && !!user,
  });

  // WS 訂閱（接 team_state_updated）
  const { handleWsMessage, refetchNow } = gameState;
  const { isConnected } = useTeamWebSocket({
    teamId,
    userId,
    userName: user?.firstName || user?.email?.split("@")[0] || "玩家",
    onMessage: handleWsMessage as (msg: unknown) => void,
  });

  // 🛡️ 2026-07-04 多人穩定性 Phase A3：ws 重連 → 立即重拉狀態（不等 10s poll）
  //   覆蓋所有走 useTeamPagePersistence 的 52 個多人元件；version 守衛防倒退
  const wsHadConnectedRef = useRef(false);
  useEffect(() => {
    if (isConnected) {
      if (wsHadConnectedRef.current) refetchNow();
      wsHadConnectedRef.current = true;
    }
  }, [isConnected, refetchNow]);

  return { ...gameState, teamId, userId };
}
