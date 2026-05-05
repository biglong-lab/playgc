import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import QuizBlitz, {
  QuizBlitzConfig,
  QuizBlitzState,
  QuizAnswer,
} from "./QuizBlitz";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: QuizBlitzConfig = {
  title: "快問快答",
  questions: [
    {
      questionId: "q1",
      text: "範例問題：台灣最高的山是？",
      options: ["玉山", "合歡山", "雪山", "阿里山"],
      correctIndex: 0,
    },
  ],
  showLeaderboard: true,
};

const DEFAULT_STATE: QuizBlitzState = {
  currentQuestionIndex: -1,
  answers: [],
  phase: "waiting",
};

export default function QuizBlitzPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: QuizBlitzConfig =
    raw && typeof raw === "object" && "questions" in raw
      ? (raw as QuizBlitzConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: QuizBlitzConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<QuizBlitzState>({
      gameId,
      sessionId,
      pageId,
      type: "quiz_blitz",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleAnswer(questionId: string, answerIndex: number) {
    const already = state.answers.find(
      (a: QuizAnswer) =>
        a.userId === myUserId && a.questionId === questionId
    );
    if (already) return;
    const newAnswer: QuizAnswer = {
      userId: myUserId,
      userName: myUserName,
      questionId,
      answerIndex,
      answeredAt: Date.now(),
    };
    updateState({ ...state, answers: [...state.answers, newAnswer] });
  }

  function handleAdvance() {
    const questions = config.questions ?? [];
    if (state.phase === "waiting") {
      updateState({ ...state, phase: "question", currentQuestionIndex: 0 });
    } else if (state.phase === "question") {
      updateState({ ...state, phase: "reveal" });
    } else if (state.phase === "reveal") {
      const nextIndex = state.currentQuestionIndex + 1;
      if (nextIndex >= questions.length) {
        updateState({ ...state, phase: "done" });
      } else {
        updateState({
          ...state,
          currentQuestionIndex: nextIndex,
          phase: "question",
        });
      }
    }
  }

  return (
    <QuizBlitz
      config={config}
      state={state}
      myUserId={myUserId}
      onAnswer={handleAnswer}
      onAdvance={handleAdvance}
    />
  );
}
