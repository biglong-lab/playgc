import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import FastBuzz, {
  FastBuzzConfig,
  FastBuzzState,
  BuzzRecord,
} from "./FastBuzz";

const DEFAULT_CONFIG: FastBuzzConfig = {
  title: "搶答競賽",
  questions: [],
};

const DEFAULT_STATE: FastBuzzState = {
  currentQuestionIndex: 0,
  buzzes: [],
  phase: "waiting",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): FastBuzzConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src = "questions" in r ? r : "config" in r && r.config && typeof r.config === "object" ? r.config as Record<string, unknown> : {};
    if ("questions" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        questions: Array.isArray(src.questions) ? (src.questions as string[]) : DEFAULT_CONFIG.questions,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function FastBuzzPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<FastBuzzState>({
    gameId,
    sessionId,
    pageId,
    type: "fast_buzz",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleBuzz() {
    const already = state.buzzes.find(
      (b) => b.userId === myUserId && b.questionIndex === state.currentQuestionIndex
    );
    if (already) return;
    const newBuzz: BuzzRecord = {
      buzzId: `${myUserId}-${state.currentQuestionIndex}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      buzzedAt: Date.now(),
      result: "pending",
      questionIndex: state.currentQuestionIndex,
    };
    updateState({ ...state, buzzes: [...state.buzzes, newBuzz] });
  }

  function handleJudge(buzzId: string, isCorrect: boolean) {
    updateState({
      ...state,
      buzzes: state.buzzes.map((b) =>
        b.buzzId === buzzId ? { ...b, result: isCorrect ? "correct" : "wrong" } : b
      ),
      phase: "judging",
    });
  }

  function handleAdvance() {
    if (state.phase === "waiting") {
      updateState({ ...state, phase: "open" });
    } else if (state.phase === "open") {
      const hasBuzz = state.buzzes.some(
        (b) => b.questionIndex === state.currentQuestionIndex
      );
      updateState({ ...state, phase: hasBuzz ? "judging" : "judging" });
    } else if (state.phase === "judging") {
      const questions = config.questions ?? [];
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= questions.length) {
        updateState({ ...state, phase: "done" });
      } else {
        updateState({ ...state, currentQuestionIndex: nextIndex, phase: "open" });
      }
    }
  }

  return (
    <FastBuzz
      config={config}
      state={state}
      myUserId={myUserId}
      onBuzz={handleBuzz}
      onJudge={handleJudge}
      onAdvance={handleAdvance}
    />
  );
}
