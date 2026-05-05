import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import TimedChallenge, {
  TimedChallengeConfig,
  TimedChallengeState,
  CompletionRecord,
} from "./TimedChallenge";

const DEFAULT_CONFIG: TimedChallengeConfig = {
  title: "限時挑戰",
  challengeText: "完成任務後按下按鈕！",
  durationSeconds: 60,
};

const DEFAULT_STATE: TimedChallengeState = {
  completions: [],
  phase: "waiting",
  startedAt: null,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): TimedChallengeConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "durationSeconds" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("durationSeconds" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        challengeText: (src.challengeText as string) ?? DEFAULT_CONFIG.challengeText,
        durationSeconds: typeof src.durationSeconds === "number" ? src.durationSeconds : DEFAULT_CONFIG.durationSeconds,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function TimedChallengePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);
  const [now, setNow] = useState(Date.now());

  const { state, updateState, isLoaded } = useTeamPagePersistence<TimedChallengeState>({
    gameId,
    sessionId,
    pageId,
    type: "timed_challenge",
    defaultState: DEFAULT_STATE,
  });

  useEffect(() => {
    if (state.phase !== "running") return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "running" || !state.startedAt) return;
    const deadline = state.startedAt + config.durationSeconds * 1000;
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      updateState({ ...state, phase: "ended" });
      return;
    }
    const timer = setTimeout(() => {
      updateState({ ...state, phase: "ended" });
    }, remaining);
    return () => clearTimeout(timer);
  }, [state.phase, state.startedAt]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleStart() {
    updateState({ ...state, phase: "running", startedAt: Date.now() });
  }

  function handleComplete() {
    const already = state.completions.find((c) => c.userId === myUserId);
    if (already) return;
    const newCompletion: CompletionRecord = {
      completionId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      completedAt: Date.now(),
    };
    updateState({ ...state, completions: [...state.completions, newCompletion] });
  }

  function handleEnd() {
    updateState({ ...state, phase: "ended" });
  }

  return (
    <TimedChallenge
      config={config}
      state={state}
      myUserId={myUserId}
      now={now}
      onStart={handleStart}
      onComplete={handleComplete}
      onEnd={handleEnd}
    />
  );
}
