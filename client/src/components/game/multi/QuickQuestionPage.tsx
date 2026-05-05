// 💬 QuickQuestionPage — pageType="quick_question" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import QuickQuestion, { type QuickQuestionConfig, type QuickQuestionResponse } from "./QuickQuestion";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface QuickQuestionPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface QuickQuestionState extends Record<string, unknown> {
  responses: QuickQuestionResponse[];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function QuickQuestionPage({ page, sessionId, gameId, pageId, onComplete }: QuickQuestionPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: QuickQuestionConfig } | QuickQuestionConfig | null) ?? null;
  const config: QuickQuestionConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as QuickQuestionConfig | null)) ?? {
      title: "💬 快問快答",
      question: "用一句話描述你現在的心情？",
      maxLength: 40,
      anonymous: true,
    };

  const defaultState: QuickQuestionState = { responses: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<QuickQuestionState>({
    gameId, sessionId, pageId, type: "quick_question", defaultState,
  });

  const handleSubmit = useCallback(async (text: string) => {
    if (state.responses.some((r) => r.userId === myUserId)) return;
    const newResponse: QuickQuestionResponse = {
      id: generateId(),
      text,
      submittedAt: Date.now(),
      userId: myUserId,
      userName: config.anonymous !== false ? undefined : myUserName,
    };
    await updateState({ responses: [...state.responses, newResponse] });
    if (onComplete) onComplete();
  }, [state.responses, myUserId, myUserName, config.anonymous, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="quick-question-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <QuickQuestion
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSubmit={handleSubmit}
    />
  );
}
