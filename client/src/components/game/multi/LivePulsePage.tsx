// ⚡ LivePulsePage — pageType="live_pulse" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LivePulse, { type LivePulseConfig, type LivePulseState, type TapEvent } from "./LivePulse";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface LivePulsePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: LivePulseConfig = {
  title: "⚡ 即時活力計",
  subtitle: "一起點擊，感受全場能量！",
  prompt: "點擊提升活力！",
  maxLevel: 200,
};

const DEFAULT_STATE: LivePulseState = {
  taps: [],
  totalTaps: 0,
};

export default function LivePulsePage({ page, sessionId, gameId, pageId, onComplete }: LivePulsePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: LivePulseConfig } | LivePulseConfig | null) ?? null;
  const config: LivePulseConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as LivePulseConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<LivePulseState>({
    gameId,
    sessionId,
    pageId,
    type: "live_pulse",
    defaultState: DEFAULT_STATE,
  });

  const handleTap = useCallback(async () => {
    const existing = state.taps.find((t: TapEvent) => t.userId === myUserId);
    const newCount = (existing?.count ?? 0) + 1;
    const updatedTaps: TapEvent[] = [
      ...state.taps.filter((t: TapEvent) => t.userId !== myUserId),
      { userId: myUserId, userName: myUserName, count: newCount, lastAt: Date.now() },
    ];
    await updateState({
      ...state,
      taps: updatedTaps,
      totalTaps: state.totalTaps + 1,
    });
  }, [state, myUserId, myUserName, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <LivePulse
      config={config}
      state={state}
      myUserId={myUserId}
      onTap={handleTap}
    />
  );
}
