// 🏃 useTeamRelaySync — RelayMission 元件的隊伍同步 hook
//
// 職責：
//   - 維護隊伍共享：currentSegmentIndex / completedSegments / isAllComplete
//   - 玩家提交答案 → client-side 驗證（normalize 比對 segments[i].answer）
//     正確 → 標記段完成 + 推進 currentSegmentIndex + 廣播 segment_complete
//     全部段完成 → 廣播 all_complete + setIsAllComplete
//     錯誤 → 不變更狀態（玩家可重試）
//   - 接收隊友的 segment_complete / all_complete 同步狀態
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.7
//
// 簡化決策：client-side 驗證（同 LockCoop）— 接力主要是體驗 + 段間流轉，無計分作弊空間

import { useCallback, useEffect, useState } from "react";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { isSegmentAnswerCorrect } from "../../multi/RelayMission";
import type { RelayMissionConfig } from "@shared/schema";

interface UseTeamRelaySyncOptions {
  teamId: string | undefined;
  userId: string | undefined;
  userName: string | undefined;
  config: RelayMissionConfig;
  enabled?: boolean;
}

export interface CompletedSegment {
  segmentIndex: number;
  completedBy: string;
}

export interface TeamRelayState {
  currentSegmentIndex: number;
  completedSegments: CompletedSegment[];
  isAllComplete: boolean;
  /** 玩家提交答案 — 驗證 + 廣播 */
  onSubmitAnswer: (segmentIndex: number, answer: string) => void;
  /** 答錯時 hook 內部不變更狀態，但 UI 可拿到 lastError 顯示 */
  lastError: string | null;
}

interface RelayMessage {
  type: string;
  action?: string;
  payload?: {
    segmentIndex?: number;
    completedBy?: string;
    nextSegmentIndex?: number;
  };
}

export function useTeamRelaySync({
  teamId,
  userId,
  userName,
  config,
  enabled = true,
}: UseTeamRelaySyncOptions): TeamRelayState {
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [completedSegments, setCompletedSegments] = useState<CompletedSegment[]>([]);
  const [isAllComplete, setIsAllComplete] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const totalSegments = config.segments?.length ?? 0;

  const handleMessage = useCallback(
    (msg: RelayMessage) => {
      if (msg.type !== "team_relay_sync") return;
      if (!msg.action || !msg.payload) return;

      switch (msg.action) {
        case "segment_complete": {
          const { segmentIndex, completedBy, nextSegmentIndex } = msg.payload;
          if (typeof segmentIndex !== "number") return;
          setCompletedSegments((prev) => {
            // 去重：若已記錄不再加
            if (prev.some((c) => c.segmentIndex === segmentIndex)) return prev;
            return [...prev, { segmentIndex, completedBy: completedBy || "" }];
          });
          if (typeof nextSegmentIndex === "number") {
            setCurrentSegmentIndex(nextSegmentIndex);
          }
          break;
        }
        case "all_complete":
          setIsAllComplete(true);
          break;
      }
    },
    [],
  );

  const { sendRelaySync } = useTeamWebSocket({
    teamId: enabled ? teamId : undefined,
    userId: enabled ? userId : undefined,
    userName: enabled ? userName : undefined,
    onMessage: handleMessage,
  });

  // 玩家提交答案
  const onSubmitAnswer = useCallback(
    (segmentIndex: number, answer: string) => {
      if (isAllComplete) return;
      if (segmentIndex !== currentSegmentIndex) {
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

      // 答對 → 標記完成 + 推進
      setLastError(null);
      const nextIndex = segmentIndex + 1;
      const newCompleted: CompletedSegment = {
        segmentIndex,
        completedBy: userId || "",
      };
      setCompletedSegments((prev) => {
        if (prev.some((c) => c.segmentIndex === segmentIndex)) return prev;
        return [...prev, newCompleted];
      });

      if (nextIndex >= totalSegments) {
        // 全部完成
        setIsAllComplete(true);
        sendRelaySync("segment_complete", {
          segmentIndex,
          completedBy: userId,
        });
        sendRelaySync("all_complete", {});
      } else {
        setCurrentSegmentIndex(nextIndex);
        sendRelaySync("segment_complete", {
          segmentIndex,
          completedBy: userId,
          nextSegmentIndex: nextIndex,
        });
      }
    },
    [
      isAllComplete,
      currentSegmentIndex,
      config.segments,
      totalSegments,
      userId,
      sendRelaySync,
    ],
  );

  // teamId 改變重置（避免換隊伍狀態殘留）
  useEffect(() => {
    if (!teamId) {
      setCurrentSegmentIndex(0);
      setCompletedSegments([]);
      setIsAllComplete(false);
      setLastError(null);
    }
  }, [teamId]);

  return {
    currentSegmentIndex,
    completedSegments,
    isAllComplete,
    onSubmitAnswer,
    lastError,
  };
}
