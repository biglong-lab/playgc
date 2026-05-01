// 🚩 useTeamTerritorySync — TerritoryCapture 元件的 session 同步 hook
//
// 職責：
//   - 維護 captures 陣列（每點 teamId + capturedAt）
//   - 玩家佔領 → 更新 + 廣播 capture action
//   - 接收他隊廣播 → 同步狀態
//   - cooldown 由元件 UI 端 client 計算（純函式 canCapturePoint）
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.8
//
// 為什麼用 session 範圍：地盤戰多隊共享 session（不只自己這隊看到）
//   useTeamWebSocket alsoJoinSessionId=true → ws 同時加入 session room
//   sendTerritorySync 廣播類型 territory_capture_sync 由 broadcastToSession 派發

import { useCallback, useEffect, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import type { TerritoryCapture } from "../../multi/TerritoryCapture";

interface UseTeamTerritorySyncOptions {
  teamId: string | undefined;
  sessionId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  enabled?: boolean;
}

export interface TeamTerritoryState {
  captures: TerritoryCapture[];
  /** 玩家佔領點 — 更新本地 + 廣播 */
  onCapture: (pointId: string) => void;
}

interface TerritoryMessage {
  type: string;
  action?: string;
  payload?: {
    pointId?: string;
    teamId?: string;
    capturedAt?: number;
  };
}

export function useTeamTerritorySync({
  teamId,
  sessionId,
  userId,
  userName,
  enabled = true,
}: UseTeamTerritorySyncOptions): TeamTerritoryState {
  const [captures, setCaptures] = useState<TerritoryCapture[]>([]);

  const handleMessage = useCallback(
    (msg: TerritoryMessage) => {
      if (msg.type !== "territory_capture_sync") return;
      if (!msg.payload) return;
      const { pointId, teamId: capturedByTeam, capturedAt } = msg.payload;
      if (!pointId || typeof capturedAt !== "number") return;

      setCaptures((prev) => {
        const filtered = prev.filter((c) => c.pointId !== pointId);
        return [
          ...filtered,
          { pointId, teamId: capturedByTeam ?? null, capturedAt },
        ];
      });
    },
    [],
  );

  const { sendTerritorySync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    alsoJoinSessionId: enabled ? sessionId : undefined,
    onMessage: handleMessage,
  });

  // 玩家按佔領
  const onCapture = useCallback(
    (pointId: string) => {
      if (!teamId) return;
      const now = Date.now();
      // 立刻本地 update（樂觀）
      setCaptures((prev) => {
        const filtered = prev.filter((c) => c.pointId !== pointId);
        return [...filtered, { pointId, teamId, capturedAt: now }];
      });
      // 廣播給 session 所有人
      sendTerritorySync("capture", {
        pointId,
        teamId,
        capturedAt: now,
      });
    },
    [teamId, sendTerritorySync],
  );

  // session 改變重置（避免換 session 狀態殘留）
  useEffect(() => {
    if (!sessionId) {
      setCaptures([]);
    }
  }, [sessionId]);

  return { captures, onCapture };
}
