// ⭐ FeedbackStarPage — pageType="feedback_star" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import FeedbackStar, { type FeedbackStarConfig, type FeedbackEntry } from "./FeedbackStar";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface FeedbackStarPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface FeedbackStarState extends Record<string, unknown> {
  entries: FeedbackEntry[];
}

export default function FeedbackStarPage({ page, sessionId, gameId, pageId, onComplete }: FeedbackStarPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: FeedbackStarConfig } | FeedbackStarConfig | null) ?? null;
  const config: FeedbackStarConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as FeedbackStarConfig | null)) ?? {
      title: "⭐ 活動評分",
      question: "你對這次活動的評分？",
      allowComment: true,
    };

  const defaultState: FeedbackStarState = { entries: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<FeedbackStarState>({
    gameId, sessionId, pageId, type: "feedback_star", defaultState,
  });

  const handleSubmit = useCallback(async (stars: number, comment?: string) => {
    const newEntry: FeedbackEntry = {
      userId: myUserId,
      userName: myUserName,
      stars,
      comment,
      submittedAt: Date.now(),
    };
    const filtered = state.entries.filter((e) => e.userId !== myUserId);
    await updateState({ entries: [...filtered, newEntry] });
    if (onComplete) onComplete();
  }, [state.entries, myUserId, myUserName, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="feedback-star-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <FeedbackStar
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSubmit={handleSubmit}
    />
  );
}
