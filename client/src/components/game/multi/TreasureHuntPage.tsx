// 💎 TreasureHuntPage — pageType="treasure_hunt" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import TreasureHunt, { type TreasureHuntConfig } from "./TreasureHunt";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TreasureHuntPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface TreasureState extends Record<string, unknown> {
  unlockedClueIds: string[];
}

export default function TreasureHuntPage({ page, sessionId, gameId, pageId }: TreasureHuntPageProps) {
  const rawConfig = (page.config as { config?: TreasureHuntConfig } | TreasureHuntConfig | null) ?? null;
  const config: TreasureHuntConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TreasureHuntConfig | null)) ?? {
      title: "💎 藏寶尋找",
      clues: [
        { id: "c1", prompt: "金門最大的紀念日？", answer: "823砲戰", reward: "8" },
        { id: "c2", prompt: "後浦古城別名？", answer: "金門城", reward: "0" },
        { id: "c3", prompt: "金門特產之一（飲品）？", answer: "高粱酒", reward: "0" },
      ],
      finalReward: "🏆 你解開了密碼 800！",
    };

  const defaultState: TreasureState = { unlockedClueIds: [] };

  const { state, updateState } = useTeamPagePersistence<TreasureState>({
    gameId, sessionId, pageId, type: "treasure_hunt", defaultState,
  });

  const handleUnlock = useCallback(async (clueId: string) => {
    if (state.unlockedClueIds.includes(clueId)) return;
    await updateState({ unlockedClueIds: [...state.unlockedClueIds, clueId] });
  }, [state.unlockedClueIds, updateState]);

  return <TreasureHunt config={config} state={state} onUnlockClue={handleUnlock} />;
}
