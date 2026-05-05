// 🏃 useTeamRelaySync — RelayMission 元件的隊伍同步 hook（L3 持久化版 2026-05-05）
//
// 改動：加入 server-side 持久化（team-game-state.ts）
//   - 掛載時 GET /api/team-state 回復上次狀態
//   - 答對後 POST /api/team-state 寫入 + server 廣播 team_state_updated
//   - 10s polling fallback
//   - 同時保留 WS sendRelaySync 讓即時感更好（WS 快但無持久化）

import { useCallback, useEffect, useRef, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { isSegmentAnswerCorrect } from "../../multi/RelayMission";
import { useTeamGameState } from "./useTeamGameState";
import type { RelayMissionConfig } from "@shared/schema";

const COMPONENT_TYPE = "relay_mission";

interface UseTeamRelaySyncOptions {
  teamId: string | undefined;
  sessionId: string;
  pageId: string;
  userId: string | undefined;
  userName: string | undefined;
  config: RelayMissionConfig;
  enabled?: boolean;
}

export interface CompletedSegment {
  segmentIndex: number;
  completedBy: string;
}

interface RelayPersistedState extends Record<string, unknown> {
  currentSegmentIndex: number;
  completedSegments: CompletedSegment[];
  isAllComplete: boolean;
}

export interface TeamRelayState {
  currentSegmentIndex: number;
  completedSegments: CompletedSegment[];
  isAllComplete: boolean;
  isLoaded: boolean;
  onSubmitAnswer: (segmentIndex: number, answer: string) => void;
  lastError: string | null;
}

interface RelayWsMessage {
  type: string;
  action?: string;
  payload?: { segmentIndex?: number; completedBy?: string; nextSegmentIndex?: number };
  componentType?: string;
  state?: unknown;
  version?: number;
}

export function useTeamRelaySync({
  teamId,
  sessionId,
  pageId,
  userId,
  userName,
  config,
  enabled = true,
}: UseTeamRelaySyncOptions): TeamRelayState {
  const [lastError, setLastError] = useState<string | null>(null);

  const defaultState: RelayPersistedState = {
    currentSegmentIndex: 0,
    completedSegments: [],
    isAllComplete: false,
  };

  const {
    state: persistedState,
    isLoaded,
    updateState,
    handleWsMessage: handleGameStateWsMessage,
  } = useTeamGameState<RelayPersistedState>({
    teamId,
    sessionId,
    pageId,
    type: COMPONENT_TYPE,
    defaultState,
    enabled,
  });

  const { currentSegmentIndex, completedSegments, isAllComplete } = persistedState;
  const totalSegments = config.segments?.length ?? 0;

  // 快取最新 persistedState 供 onSubmitAnswer closure 使用
  const stateRef = useRef(persistedState);
  stateRef.current = persistedState;

  const handleMessage = useCallback(
    (msg: RelayWsMessage) => {
      // 處理舊 WS-only 廣播（向後相容）
      if (msg.type === "team_relay_sync") {
        if (!msg.action || !msg.payload) return;
        if (msg.action === "segment_complete" || msg.action === "all_complete") {
          // 舊廣播不含完整狀態，觸發 polling 補取
          return;
        }
      }
      // 處理 server-driven 廣播
      handleGameStateWsMessage(msg as Parameters<typeof handleGameStateWsMessage>[0]);
    },
    [handleGameStateWsMessage],
  );

  const { sendRelaySync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    onMessage: handleMessage,
  });

  const onSubmitAnswer = useCallback(
    (segmentIndex: number, answer: string) => {
      const { currentSegmentIndex: curIdx, completedSegments: curCompleted, isAllComplete: curDone } = stateRef.current;
      if (curDone) return;
      if (segmentIndex !== curIdx) {
        setLastError("這段不是當前進行中的段");
        return;
      }
      const segment = config.segments?.[segmentIndex];
      if (!segment) {
        setLastError("段不存在");
        return;
      }
      if (!isSegmentAnswerCorrect(answer, segment.answer)) {
        setLastError("答案不正確，再試試");
        return;
      }

      setLastError(null);
      const nextIndex = segmentIndex + 1;
      const newCompleted = [
        ...curCompleted.filter((c) => c.segmentIndex !== segmentIndex),
        { segmentIndex, completedBy: userId || "" },
      ];
      const allDone = nextIndex >= totalSegments;

      const newState: RelayPersistedState = {
        currentSegmentIndex: allDone ? curIdx : nextIndex,
        completedSegments: newCompleted,
        isAllComplete: allDone,
      };

      // 即時感 WS（不等 DB）
      sendRelaySync("segment_complete", { segmentIndex, completedBy: userId, nextSegmentIndex: nextIndex });
      if (allDone) sendRelaySync("all_complete", {});

      // 持久化（覆蓋為權威狀態）
      void updateState(newState);
    },
    [config.segments, totalSegments, userId, sendRelaySync, updateState],
  );

  return {
    currentSegmentIndex,
    completedSegments,
    isAllComplete,
    isLoaded,
    onSubmitAnswer,
    lastError,
  };
}
