// 快問快答 Page — pageType="pop_quiz" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PopQuiz, { type PopQuizConfig, type PopQuizState, type PlayerAnswer } from "./PopQuiz";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PopQuizPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PopQuizConfig = {
  title: "🧠 快問快答",
  questions: [
    { id: "q1", prompt: "台灣最大的城市是？", options: ["台北", "高雄", "台中", "台南"], correctIdx: 0, timeLimitSec: 20 },
    { id: "q2", prompt: "1 + 1 = ?", options: ["1", "2", "3", "4"], correctIdx: 1, timeLimitSec: 15 },
    { id: "q3", prompt: "地球繞太陽一圈要幾天？", options: ["365", "30", "100", "500"], correctIdx: 0, timeLimitSec: 20 },
  ],
};

const DEFAULT_STATE: PopQuizState = {
  phase: "intro",
  currentQuestionIdx: 0,
  questionStartedAt: null,
  hostUserId: null,
  answers: [],
};

export default function PopQuizPage({ page, sessionId, gameId, pageId, onComplete }: PopQuizPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: PopQuizConfig } | PopQuizConfig | null) ?? null;
  const config: PopQuizConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PopQuizConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PopQuizState>({
    gameId, sessionId, pageId, type: "pop_quiz", defaultState: DEFAULT_STATE,
  });

  const handleStart = useCallback(async () => {
    if (state.phase !== "intro") return;
    await updateState({
      ...state,
      phase: "question",
      currentQuestionIdx: 0,
      questionStartedAt: Date.now(),
      hostUserId: myUserId,
      answers: [],
    });
  }, [state, myUserId, updateState]);

  const handleAnswer = useCallback(async (questionId: string, selectedIdx: number) => {
    const existing = state.answers.find(
      (a: PlayerAnswer) => a.userId === myUserId && a.questionId === questionId
    );
    if (existing) return;

    const newAnswer: PlayerAnswer = {
      userId: myUserId,
      questionId,
      selectedIdx,
      answeredAt: Date.now(),
    };
    await updateState({ ...state, answers: [...state.answers, newAnswer] });
  }, [state, myUserId, updateState]);

  const handleAdvance = useCallback(async () => {
    if (state.phase !== "question") return;
    const nextIdx = state.currentQuestionIdx + 1;
    const questions = config.questions ?? [];

    if (nextIdx >= questions.length) {
      await updateState({ ...state, phase: "done" });
      if (onComplete) onComplete();
    } else {
      await updateState({
        ...state,
        currentQuestionIdx: nextIdx,
        questionStartedAt: Date.now(),
      });
    }
  }, [state, config.questions, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <PopQuiz
      config={config}
      state={state}
      myUserId={myUserId}
      onStart={handleStart}
      onAnswer={handleAnswer}
      onAdvance={handleAdvance}
    />
  );
}
