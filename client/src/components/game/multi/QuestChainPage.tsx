// ⛓ QuestChainPage — QuestChain 元件容器（L3 持久化版 2026-05-05）
//
// 改動：localStorage → server DB + team WS sync
//   - useTeamPagePersistence 拉/寫 team_game_states（componentType=quest_chain）
//   - 重整後狀態自動回復，多玩家進度共享

import { useCallback } from "react";
import QuestChain, { type QuestChainConfig, checkStationAnswer } from "./QuestChain";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface QuestChainPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface ProgressState extends Record<string, unknown> {
  currentIndex: number;
  completedIds: string[];
  failureCount: Record<string, number>;
}

const defaultState: ProgressState = { currentIndex: 0, completedIds: [], failureCount: {} };

export default function QuestChainPage({ page, sessionId, gameId, pageId, onComplete }: QuestChainPageProps) {
  const rawConfig = (page.config as { config?: QuestChainConfig } | QuestChainConfig | null) ?? null;
  const config: QuestChainConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as QuestChainConfig | null)) ?? {};

  const { state, updateState } = useTeamPagePersistence<ProgressState>({
    gameId, sessionId, pageId, type: "quest_chain", defaultState,
  });

  const handleSubmitAnswer = useCallback(async (stationId: string, answer: string) => {
    const stations = config.stations ?? [];
    const station = stations.find((s) => s.id === stationId);
    if (!station) return;
    const isCorrect = checkStationAnswer(station, answer);
    if (!isCorrect) {
      const newFailureCount = { ...state.failureCount, [stationId]: (state.failureCount[stationId] ?? 0) + 1 };
      await updateState({ ...state, failureCount: newFailureCount });
      return;
    }
    if (state.completedIds.includes(stationId)) return;
    const newCompleted = [...state.completedIds, stationId];
    const newCurrentIndex = Math.min(state.currentIndex + 1, stations.length);
    await updateState({ ...state, completedIds: newCompleted, currentIndex: newCurrentIndex });
  }, [config.stations, state, updateState]);

  return (
    <QuestChain
      config={config}
      currentIndex={state.currentIndex}
      completedIds={state.completedIds}
      failureCount={state.failureCount}
      onSubmitAnswer={handleSubmitAnswer}
      onComplete={onComplete ? () => onComplete() : undefined}
    />
  );
}
