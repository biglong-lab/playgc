// 🌡️ MoodMeterPage — pageType="mood_meter" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import MoodMeter, { type MoodMeterConfig } from "./MoodMeter";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface MoodMeterPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface MoodMeterState extends Record<string, unknown> {
  votes: Record<string, number>;
}

export default function MoodMeterPage({ page, sessionId, gameId, pageId }: MoodMeterPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: MoodMeterConfig } | MoodMeterConfig | null) ?? null;
  const config: MoodMeterConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as MoodMeterConfig | null)) ?? {
      title: "🌡️ 活力確認",
      question: "你現在的活力是？",
    };

  const defaultState: MoodMeterState = { votes: {} };

  const { state, updateState, isLoaded } = useTeamPagePersistence<MoodMeterState>({
    gameId, sessionId, pageId, type: "mood_meter", defaultState,
  });

  const handleVote = useCallback(async (rating: number) => {
    await updateState({ votes: { ...state.votes, [myUserId]: rating } });
  }, [state.votes, myUserId, updateState]);

  if (!isLoaded) {
    return (
      <Card data-testid="mood-meter-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <MoodMeter
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
    />
  );
}
