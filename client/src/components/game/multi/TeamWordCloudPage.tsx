// 🌐 TeamWordCloudPage — pageType="team_word_cloud" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TeamWordCloud, { type TeamWordCloudConfig, type WordEntry } from "./TeamWordCloud";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TeamWordCloudPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface TeamWordCloudState extends Record<string, unknown> {
  entries: WordEntry[];
}

export default function TeamWordCloudPage({ page, sessionId, gameId, pageId, onComplete }: TeamWordCloudPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: TeamWordCloudConfig } | TeamWordCloudConfig | null) ?? null;
  const config: TeamWordCloudConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TeamWordCloudConfig | null)) ?? {
      title: "🌐 團隊詞雲",
      question: "一個詞描述你現在的感受？",
      maxWordsPerPerson: 3,
    };

  const defaultState: TeamWordCloudState = { entries: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamWordCloudState>({
    gameId, sessionId, pageId, type: "team_word_cloud", defaultState,
  });

  const handleSubmit = useCallback(async (words: string[]) => {
    const newEntry: WordEntry = {
      userId: myUserId,
      userName: myUserName,
      words,
      submittedAt: Date.now(),
    };
    const filtered = state.entries.filter((e) => e.userId !== myUserId);
    await updateState({ entries: [...filtered, newEntry] });
    if (onComplete) onComplete();
  }, [state.entries, myUserId, myUserName, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="word-cloud-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamWordCloud
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSubmit={handleSubmit}
    />
  );
}
