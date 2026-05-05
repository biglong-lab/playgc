// 🗳️ MultiVotePage — pageType="multi_vote" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import MultiVote, { type MultiVoteConfig, type MultiVoteState, type VoteRecord } from "./MultiVote";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface MultiVotePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function MultiVotePage({ page, sessionId, gameId, pageId, onComplete }: MultiVotePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: MultiVoteConfig } | MultiVoteConfig | null) ?? null;
  const config: MultiVoteConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as MultiVoteConfig | null)) ?? {
      title: "🗳️ 即時投票",
      question: "你的選擇是？",
      options: [
        { id: "a", label: "選項 A", emoji: "🔵" },
        { id: "b", label: "選項 B", emoji: "🟢" },
        { id: "c", label: "選項 C", emoji: "🔴" },
      ],
      showResultsAfterVote: true,
    };

  const defaultState: MultiVoteState = { votes: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<MultiVoteState>({
    gameId, sessionId, pageId, type: "multi_vote", defaultState,
  });

  const handleVote = useCallback(async (optionIds: string[]) => {
    const newRecord: VoteRecord = {
      userId: myUserId,
      userName: myUserName,
      optionIds,
      votedAt: Date.now(),
    };
    const filtered = state.votes.filter((v: VoteRecord) => v.userId !== myUserId);
    await updateState({ votes: [...filtered, newRecord] });
    if (onComplete) onComplete();
  }, [state.votes, myUserId, myUserName, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <MultiVote
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
    />
  );
}
