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
  const { handleWsMessage } = gameState;
  useTeamWebSocket({
    teamId,
    userId,
    userName: user?.firstName || user?.email?.split("@")[0] || "玩家",
    onMessage: handleWsMessage as (msg: unknown) => void,
  });

  return { ...gameState, teamId, userId };
}
