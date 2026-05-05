// ⏱️ GroupTimerPage — pageType="group_timer" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GroupTimer, { type GroupTimerConfig } from "./GroupTimer";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface GroupTimerPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface GroupTimerState extends Record<string, unknown> {
  startedAt: number | null;
  startedBy: string | null;
}

export default function GroupTimerPage({ page, sessionId, gameId, pageId }: GroupTimerPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: GroupTimerConfig } | GroupTimerConfig | null) ?? null;
  const config: GroupTimerConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GroupTimerConfig | null)) ?? {
      title: "⏱️ 限時倒數",
      durationSeconds: 300,
      completedText: "時間結束，請回到集合點！",
    };

  const defaultState: GroupTimerState = { startedAt: null, startedBy: null };

  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupTimerState>({
    gameId, sessionId, pageId, type: "group_timer", defaultState,
  });

  const handleStart = useCallback(async () => {
    if (state.startedAt !== null) return;
    await updateState({ startedAt: Date.now(), startedBy: myUserId });
  }, [state.startedAt, myUserId, updateState]);

  if (!isLoaded) {
    return (
      <Card data-testid="group-timer-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <GroupTimer
      config={config}
      state={state}
      myUserId={myUserId}
      onStart={handleStart}
    />
  );
}
