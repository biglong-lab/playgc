// 🎯 CountdownRevealPage — pageType="countdown_reveal" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CountdownReveal, { type CountdownRevealConfig, type CountdownRevealState } from "./CountdownReveal";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CountdownRevealPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function CountdownRevealPage({ page, sessionId, gameId, pageId, onComplete }: CountdownRevealPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: CountdownRevealConfig } | CountdownRevealConfig | null) ?? null;
  const config: CountdownRevealConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CountdownRevealConfig | null)) ?? {
      title: "🎯 倒數揭曉",
      revealText: "🎉 恭喜！",
      revealEmoji: "🎉",
      durationSeconds: 5,
    };

  const defaultState: CountdownRevealState = { startedAt: null, startedBy: null };

  const { state, updateState, isLoaded } = useTeamPagePersistence<CountdownRevealState>({
    gameId, sessionId, pageId, type: "countdown_reveal", defaultState,
  });

  const handleStart = useCallback(async () => {
    await updateState({ startedAt: Date.now(), startedBy: myUserId });
    const duration = config.durationSeconds ?? 5;
    setTimeout(() => {
      if (onComplete) onComplete();
    }, (duration + 2) * 1000);
  }, [updateState, myUserId, config.durationSeconds, onComplete]);

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
    <CountdownReveal
      config={config}
      state={state}
      myUserId={myUserId}
      isHost={false}
      onStart={handleStart}
    />
  );
}
