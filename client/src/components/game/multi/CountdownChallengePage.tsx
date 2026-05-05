import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CountdownChallenge from "./CountdownChallenge";
import type {
  CountdownChallengeConfig,
  CountdownChallengeState,
  ChallengeEntry,
} from "./CountdownChallenge";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CountdownChallengePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: CountdownChallengeConfig = {
  title: "⏱️ 限時挑戰",
  challenge: "在時間內完成任務！",
  durationSeconds: 60,
  successLabel: "完成了！",
  failLabel: "放棄",
  showLeaderboard: true,
};

const DEFAULT_STATE: CountdownChallengeState = {
  startedAt: null,
  entries: [],
};

export default function CountdownChallengePage({ page, sessionId, gameId, pageId }: CountdownChallengePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: CountdownChallengeConfig } | CountdownChallengeConfig | null) ?? null;
  const config: CountdownChallengeConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CountdownChallengeConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CountdownChallengeState>({
    gameId,
    sessionId,
    pageId,
    type: "countdown_challenge",
    defaultState: DEFAULT_STATE,
  });

  const [nowMs, setNowMs] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (state.startedAt !== null) {
      timerRef.current = setInterval(() => setNowMs(Date.now()), 200);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.startedAt]);

  const handleStart = useCallback(async () => {
    if (state.startedAt !== null) return;
    await updateState({ ...state, startedAt: Date.now() });
  }, [state, updateState]);

  const handleComplete = useCallback(async () => {
    const myEntry = state.entries.find((e: ChallengeEntry) => e.userId === myUserId);
    if (myEntry) return;
    const entry: ChallengeEntry = {
      userId: myUserId,
      userName: myUserName,
      completed: true,
      completedAt: Date.now(),
    };
    await updateState({ ...state, entries: [...state.entries, entry] });
  }, [state, myUserId, myUserName, updateState]);

  const handleFail = useCallback(async () => {
    const myEntry = state.entries.find((e: ChallengeEntry) => e.userId === myUserId);
    if (myEntry) return;
    const entry: ChallengeEntry = {
      userId: myUserId,
      userName: myUserName,
      completed: false,
    };
    await updateState({ ...state, entries: [...state.entries, entry] });
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
    <CountdownChallenge
      config={config}
      state={state}
      myUserId={myUserId}
      nowMs={nowMs}
      onStart={handleStart}
      onComplete={handleComplete}
      onFail={handleFail}
    />
  );
}
