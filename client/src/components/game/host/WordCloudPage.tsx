// 💬 WordCloudPage — GamePageRenderer 用此元件對應 pageType="host_word_cloud"

import { useCallback } from "react";
import WordCloud, {
  type WordCloudConfig,
  type WordCloudState,
  buildInitialWordCloudState,
} from "./WordCloud";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

const MAX_RECENT_WORDS = 20;
const DEFAULT_MAX_WORDS_PER_USER = 3;
const DEFAULT_MAX_LENGTH = 10;

interface WordCloudPageProps {
  page: Page;
}

export default function WordCloudPage({ page }: WordCloudPageProps) {
  const rawConfig = (page.config as { config?: WordCloudConfig } | WordCloudConfig | null) ?? null;
  const config: WordCloudConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as WordCloudConfig | null)) ?? {};
  const maxWordsPerUser = config.maxWordsPerUser ?? DEFAULT_MAX_WORDS_PER_USER;
  const maxLength = config.maxLength ?? DEFAULT_MAX_LENGTH;

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: WordCloudState | null,
    ): WordCloudState | null => {
      if (pulseType !== "submit") return null;

      const word = (payload as { word?: string })?.word?.trim().slice(0, maxLength);
      const userId = (payload as { userId?: string })?.userId?.trim();
      if (!word || !userId) return null;

      const baseState = currentState ?? buildInitialWordCloudState();

      // 玩家上限檢查（防 ws 訊息直送繞過 client 限制）
      const userCount = baseState.submitters[userId] ?? 0;
      if (userCount >= maxWordsPerUser) return null;

      const newRecent = {
        word,
        ts: Date.now(),
        x: Math.floor(Math.random() * 80) + 5, // 5-85%
      };

      return {
        wordCounts: {
          ...baseState.wordCounts,
          [word]: (baseState.wordCounts[word] ?? 0) + 1,
        },
        totalSubmissions: baseState.totalSubmissions + 1,
        recentWords: [...baseState.recentWords, newRecent].slice(-MAX_RECENT_WORDS),
        submitters: {
          ...baseState.submitters,
          [userId]: userCount + 1,
        },
      };
    },
    [maxLength, maxWordsPerUser],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<WordCloudState>({
    onPulse: handlePulse,
  });

  return (
    <WordCloud
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
