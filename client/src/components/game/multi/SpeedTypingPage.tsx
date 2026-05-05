import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import SpeedTyping, {
  SpeedTypingConfig,
  SpeedTypingState,
  TypingResult,
} from "./SpeedTyping";

const DEFAULT_CONFIG: SpeedTypingConfig = {
  title: "競速打字",
  phrase: "請輸入這段文字",
  maxSeconds: 60,
};

const DEFAULT_STATE: SpeedTypingState = {
  results: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): SpeedTypingConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "phrase" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("phrase" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        phrase: (src.phrase as string) ?? DEFAULT_CONFIG.phrase,
        maxSeconds: (src.maxSeconds as number) ?? DEFAULT_CONFIG.maxSeconds,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function SpeedTypingPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);

  const { state, updateState, isLoaded } = useTeamPagePersistence<SpeedTypingState>({
    gameId,
    sessionId,
    pageId,
    type: "speed_typing",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-green-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(seconds: number, accuracy: number) {
    const already = state.results.find((r) => r.userId === myUserId);
    if (already) return;
    const newResult: TypingResult = {
      resultId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      seconds,
      accuracy,
    };
    updateState({ ...state, results: [...state.results, newResult] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <SpeedTyping
      config={config}
      state={state}
      myUserId={myUserId}
      now={now}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
