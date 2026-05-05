import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { SpeedRound, SpeedRoundConfig, SpeedRoundState, SpeedAnswer } from "./SpeedRound";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: SpeedRoundConfig = {
  title: "⚡ 限時搶答",
  question: "問題請在 admin 設定",
  correctAnswer: "",
  answerLabel: "輸入你的答案",
  maxLength: 60,
  hint: "",
};

function extractConfig(raw: Record<string, unknown>): SpeedRoundConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    correctAnswer: typeof raw.correctAnswer === "string" ? raw.correctAnswer : DEFAULT_CONFIG.correctAnswer,
    answerLabel: typeof raw.answerLabel === "string" ? raw.answerLabel : DEFAULT_CONFIG.answerLabel,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    hint: typeof raw.hint === "string" ? raw.hint : DEFAULT_CONFIG.hint,
  };
}

const DEFAULT_STATE: SpeedRoundState = { answers: [], revealed: false };

export default function SpeedRoundPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<SpeedRoundState>({
    gameId,
    sessionId,
    pageId,
    type: "speed_round",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(answer: string) {
    const alreadyAnswered = state.answers.some((a: SpeedAnswer) => a.userId === userId);
    if (alreadyAnswered) return;
    const isCorrect = answer.trim().toLowerCase() === resolvedConfig.correctAnswer.trim().toLowerCase();
    const rank = state.answers.length + 1;
    const newAnswer: SpeedAnswer = {
      answerId: `sr-${Date.now()}-${userId}`,
      userId,
      userName,
      answer,
      isCorrect,
      rank,
    };
    updateState({ ...state, answers: [...state.answers, newAnswer] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <SpeedRound
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
