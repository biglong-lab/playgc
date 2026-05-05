// 🎯 CollectiveScorePage — pageType="collective_score" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import CollectiveScore, { type CollectiveScoreConfig } from "./CollectiveScore";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CollectiveScorePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface ContributorEntry extends Record<string, unknown> {
  userId: string;
  name: string;
  total: number;
}

interface CollectiveScoreState extends Record<string, unknown> {
  totalScore: number;
  contributors: ContributorEntry[];
  isReached: boolean;
}

export default function CollectiveScorePage({ page, sessionId, gameId, pageId }: CollectiveScorePageProps) {
  const { user } = useAuth();
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";
  const myUserId = user?.id ?? "";

  const rawConfig = (page.config as { config?: CollectiveScoreConfig } | CollectiveScoreConfig | null) ?? null;
  const config: CollectiveScoreConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CollectiveScoreConfig | null)) ?? {
      title: "🎯 班際合作達標",
      targetScore: 1000,
      celebrationText: "🎉 全班一起達成目標！",
    };

  const defaultState: CollectiveScoreState = { totalScore: 0, contributors: [], isReached: false };

  const { state, updateState } = useTeamPagePersistence<CollectiveScoreState>({
    gameId, sessionId, pageId, type: "collective_score", defaultState,
  });

  const handleContribute = useCallback(async (delta: number) => {
    if (state.isReached) return;
    const newTotal = state.totalScore + delta;
    const targetReached = newTotal >= (config.targetScore ?? 1000);
    const existing = state.contributors.find((c) => c.userId === myUserId);
    const newContributors: ContributorEntry[] = state.contributors.map((c) =>
      c.userId === myUserId ? { ...c, total: c.total + delta } : c,
    );
    if (!existing) newContributors.push({ userId: myUserId, name: myUserName, total: delta });
    await updateState({ totalScore: newTotal, contributors: newContributors, isReached: targetReached });
  }, [state, config.targetScore, myUserId, myUserName, updateState]);

  const contributors = state.contributors.map((c) => ({ name: c.name, total: c.total }));

  return (
    <CollectiveScore
      config={config}
      state={{ totalScore: state.totalScore, contributors, isReached: state.isReached }}
      myUserName={myUserName}
      onContribute={handleContribute}
    />
  );
}
