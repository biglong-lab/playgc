// ✅ CheckInPage — pageType="check_in" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CheckIn, { type CheckInConfig, type ArrivalEntry } from "./CheckIn";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CheckInPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface CheckInState extends Record<string, unknown> {
  arrivals: ArrivalEntry[];
}

export default function CheckInPage({ page, sessionId, gameId, pageId, onComplete }: CheckInPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: CheckInConfig } | CheckInConfig | null) ?? null;
  const config: CheckInConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CheckInConfig | null)) ?? {
      title: "✅ 活動簽到",
      message: "點擊簽到，讓主持人知道你已到場！",
      showNames: true,
    };

  const defaultState: CheckInState = { arrivals: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<CheckInState>({
    gameId, sessionId, pageId, type: "check_in", defaultState,
  });

  const handleCheckIn = useCallback(async () => {
    if (state.arrivals.some((a) => a.userId === myUserId)) return;
    const newArrival: ArrivalEntry = {
      userId: myUserId,
      userName: myUserName,
      arrivedAt: Date.now(),
    };
    await updateState({ arrivals: [...state.arrivals, newArrival] });
    if (onComplete) onComplete();
  }, [state.arrivals, myUserId, myUserName, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="check-in-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <CheckIn
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onCheckIn={handleCheckIn}
    />
  );
}
