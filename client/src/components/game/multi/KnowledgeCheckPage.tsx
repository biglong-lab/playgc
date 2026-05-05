import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import KnowledgeCheck from "./KnowledgeCheck";
import type {
  KnowledgeCheckConfig,
  KnowledgeCheckState,
  KcAnswer,
} from "./KnowledgeCheck";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface KnowledgeCheckPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: KnowledgeCheckConfig = {
  title: "🧠 知識確認",
  questions: [
    {
      id: "q1",
      text: "台灣的首都是哪裡？",
      options: ["台南", "台北", "高雄", "台中"],
      correctIndex: 1,
      explanation: "台北市是台灣的首都，也是政治、經濟中心。",
    },
  ],
  showExplanation: true,
  pointsPerCorrect: 10,
};

const DEFAULT_STATE: KnowledgeCheckState = {
  currentQuestionIndex: 0,
  answers: [],
  revealed: false,
};

export default function KnowledgeCheckPage({ page, sessionId, gameId, pageId }: KnowledgeCheckPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: KnowledgeCheckConfig } | KnowledgeCheckConfig | null) ?? null;
  const config: KnowledgeCheckConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as KnowledgeCheckConfig | null)) ?? DEFAULT_CONFIG;

  const isHost = (page as { isHost?: boolean }).isHost ?? false;

  const { state, updateState, isLoaded } = useTeamPagePersistence<KnowledgeCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "knowledge_check",
    defaultState: DEFAULT_STATE,
  });

  const handleAnswer = useCallback(
    async (selectedIndex: number) => {
      const currentQ = config.questions[state.currentQuestionIndex];
      if (!currentQ || !myUserId) return;
      const already = state.answers.some(
        (a: KcAnswer) => a.userId === myUserId && a.questionId === currentQ.id
      );
      if (already || state.revealed) return;
      const newAnswer: KcAnswer = {
        userId: myUserId,
        userName: myUserName,
        questionId: currentQ.id,
        selectedIndex,
        answeredAt: Date.now(),
      };
      await updateState({ ...state, answers: [...state.answers, newAnswer] });
    },
    [config.questions, state, myUserId, myUserName, updateState]
  );

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  const handleNext = useCallback(async () => {
    const nextIndex = state.currentQuestionIndex + 1;
    await updateState({
      ...state,
      currentQuestionIndex: nextIndex,
      revealed: false,
    });
  }, [state, updateState]);

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
    <KnowledgeCheck
      config={config}
      state={state}
      myUserId={myUserId}
      isHost={isHost}
      onAnswer={handleAnswer}
      onReveal={handleReveal}
      onNext={handleNext}
    />
  );
}
