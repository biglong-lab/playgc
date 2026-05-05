// 📖 StoryChainPage — pageType="story_chain" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import StoryChain, { type StoryChainConfig, type StoryChainState, type StoryEntry } from "./StoryChain";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface StoryChainPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: StoryChainConfig = {
  title: "📖 接龍故事",
  opening: "從前從前，有一個很特別的地方…",
  maxWordsPerContribution: 20,
  maxContributions: 10,
  finishText: "感謝所有創作者！",
};

const DEFAULT_STATE: StoryChainState = {
  entries: [],
  finished: false,
};

export default function StoryChainPage({ page, sessionId, gameId, pageId, onComplete }: StoryChainPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: StoryChainConfig } | StoryChainConfig | null) ?? null;
  const config: StoryChainConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as StoryChainConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<StoryChainState>({
    gameId, sessionId, pageId, type: "story_chain", defaultState: DEFAULT_STATE,
  });

  const handleAdd = useCallback(async (text: string) => {
    const newEntry: StoryEntry = {
      id: `e-${Date.now()}-${myUserId.slice(-4)}`,
      authorId: myUserId,
      authorName: myUserName,
      text,
      addedAt: Date.now(),
    };
    const updated = [...state.entries, newEntry];
    await updateState({ ...state, entries: updated });
  }, [state, myUserId, myUserName, updateState]);

  const handleFinish = useCallback(async () => {
    await updateState({ ...state, finished: true });
    if (onComplete) onComplete();
  }, [state, updateState, onComplete]);

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
    <StoryChain
      config={config}
      state={state}
      myUserId={myUserId}
      onAdd={handleAdd}
      onFinish={handleFinish}
    />
  );
}
