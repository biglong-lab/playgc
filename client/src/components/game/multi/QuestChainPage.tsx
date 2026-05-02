// ⛓ QuestChainPage — QuestChain 元件容器（W18 D4 簡化版）
//
// 範圍（W18 D4）：local state + localStorage 持久化
// 未來（W19+）：可加 team WS sync 讓隊員共享進度

import { useCallback, useEffect, useState } from "react";
import QuestChain, {
  type QuestChainConfig,
  checkStationAnswer,
} from "./QuestChain";
import type { Page } from "@shared/schema";

const STORAGE_KEY_PREFIX = "quest-chain-progress:";

interface QuestChainPageProps {
  page: Page;
  /** game flow callback（完成後跳下一頁）*/
  onComplete?: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
}

interface ProgressState {
  currentIndex: number;
  completedIds: string[];
  failureCount: Record<string, number>;
}

const initialState: ProgressState = {
  currentIndex: 0,
  completedIds: [],
  failureCount: {},
};

export default function QuestChainPage({ page, onComplete }: QuestChainPageProps) {
  const rawConfig = (page.config as { config?: QuestChainConfig } | QuestChainConfig | null) ?? null;
  const config: QuestChainConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as QuestChainConfig | null)) ?? {};

  const storageKey = `${STORAGE_KEY_PREFIX}${page.id}`;

  // 從 localStorage 讀進度（重整不會卡關）
  const [state, setState] = useState<ProgressState>(() => {
    if (typeof window === "undefined") return initialState;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved) as ProgressState;
    } catch {
      // ignore
    }
    return initialState;
  });

  // 寫回 localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [storageKey, state]);

  const handleSubmitAnswer = useCallback(
    (stationId: string, answer: string) => {
      const stations = config.stations ?? [];
      const station = stations.find((s) => s.id === stationId);
      if (!station) return;

      const isCorrect = checkStationAnswer(station, answer);
      setState((prev) => {
        if (!isCorrect) {
          return {
            ...prev,
            failureCount: {
              ...prev.failureCount,
              [stationId]: (prev.failureCount[stationId] ?? 0) + 1,
            },
          };
        }
        // 正確 → 加進 completedIds、推進 currentIndex
        if (prev.completedIds.includes(stationId)) return prev;
        const newCompleted = [...prev.completedIds, stationId];
        const newCurrentIndex = Math.min(prev.currentIndex + 1, stations.length);
        return {
          ...prev,
          completedIds: newCompleted,
          currentIndex: newCurrentIndex,
        };
      });
    },
    [config.stations],
  );

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
