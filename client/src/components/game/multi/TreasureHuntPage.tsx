// 💎 TreasureHuntPage — GamePageRenderer 對應 pageType="treasure_hunt"
// W4 D2 簡化版：本地 state，下輪 D5 接 useTeamTreasureSync hook

import { useState } from "react";
import TreasureHunt, { type TreasureHuntConfig } from "./TreasureHunt";
import type { Page } from "@shared/schema";

interface TreasureHuntPageProps {
  page: Page;
}

interface TreasureState {
  unlockedClueIds: string[];
}

export default function TreasureHuntPage({ page }: TreasureHuntPageProps) {
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

  const [state, setState] = useState<TreasureState>({ unlockedClueIds: [] });

  const handleUnlock = (clueId: string) => {
    setState((prev) => ({
      unlockedClueIds: prev.unlockedClueIds.includes(clueId)
        ? prev.unlockedClueIds
        : [...prev.unlockedClueIds, clueId],
    }));
  };

  return <TreasureHunt config={config} state={state} onUnlockClue={handleUnlock} />;
}
