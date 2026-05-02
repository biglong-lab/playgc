// 🎯 CollectiveScorePage — pageType="collective_score" 對應容器
// W4 D3 簡化版：本地 state（W4 D5 整合 useTeamCollectiveSync）

import { useState } from "react";
import CollectiveScore, { type CollectiveScoreConfig } from "./CollectiveScore";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";

interface CollectiveScorePageProps {
  page: Page;
}

interface CollectiveScoreState {
  totalScore: number;
  contributors: { name: string; total: number }[];
  isReached: boolean;
}

export default function CollectiveScorePage({ page }: CollectiveScorePageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: CollectiveScoreConfig } | CollectiveScoreConfig | null) ?? null;
  const config: CollectiveScoreConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CollectiveScoreConfig | null)) ?? {
      title: "🎯 班際合作達標",
      targetScore: 1000,
      celebrationText: "🎉 全班一起達成目標！",
    };

  const [state, setState] = useState<CollectiveScoreState>({
    totalScore: 0,
    contributors: [],
    isReached: false,
  });

  const handleContribute = (delta: number) => {
    setState((prev) => {
      if (prev.isReached) return prev;
      const newTotal = prev.totalScore + delta;
      const targetReached = newTotal >= (config.targetScore ?? 1000);

      const idx = prev.contributors.findIndex((c) => c.name === myUserName);
      let newContributors = [...prev.contributors];
      if (idx >= 0) {
        newContributors[idx] = {
          ...newContributors[idx],
          total: newContributors[idx].total + delta,
        };
      } else {
        newContributors.push({ name: myUserName, total: delta });
      }

      return {
        totalScore: newTotal,
        contributors: newContributors,
        isReached: targetReached,
      };
    });
  };

  return (
    <CollectiveScore
      config={config}
      state={state}
      myUserName={myUserName}
      onContribute={handleContribute}
    />
  );
}
