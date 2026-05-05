// 📬 QuestionBoxPage — pageType="question_box" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import QuestionBox, { type QuestionBoxConfig, type QuestionBoxState, type Question } from "./QuestionBox";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface QuestionBoxPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: QuestionBoxConfig = {
  title: "📬 提問箱",
  prompt: "你有什麼問題想問？",
  allowAnonymous: true,
  maxQuestionsPerPerson: 3,
  maxQuestionLength: 100,
};

const DEFAULT_STATE: QuestionBoxState = { questions: [] };

export default function QuestionBoxPage({ page, sessionId, gameId, pageId, onComplete }: QuestionBoxPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: QuestionBoxConfig } | QuestionBoxConfig | null) ?? null;
  const config: QuestionBoxConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as QuestionBoxConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<QuestionBoxState>({
    gameId, sessionId, pageId, type: "question_box", defaultState: DEFAULT_STATE,
  });

  const handleSubmit = useCallback(async (text: string) => {
    const newQ: Question = {
      id: `q-${Date.now()}-${myUserId.slice(-4)}`,
      text,
      authorId: myUserId,
      authorName: myUserName,
      votes: [],
      answered: false,
      createdAt: Date.now(),
    };
    await updateState({ questions: [...state.questions, newQ] });
  }, [state.questions, myUserId, myUserName, updateState]);

  const handleVote = useCallback(async (questionId: string) => {
    const updated = state.questions.map((q: Question) => {
      if (q.id !== questionId) return q;
      if (q.authorId === myUserId) return q;
      const hasVoted = q.votes.includes(myUserId);
      return {
        ...q,
        votes: hasVoted ? q.votes.filter((uid: string) => uid !== myUserId) : [...q.votes, myUserId],
      };
    });
    await updateState({ questions: updated });
  }, [state.questions, myUserId, updateState]);

  const handleMarkAnswered = useCallback(async (questionId: string) => {
    const updated = state.questions.map((q: Question) =>
      q.id === questionId ? { ...q, answered: !q.answered } : q
    );
    await updateState({ questions: updated });
    // 所有問題都回答了就觸發完成
    const allAnswered = updated.every((q: Question) => q.answered);
    if (allAnswered && updated.length > 0 && onComplete) {
      onComplete();
    }
  }, [state.questions, updateState, onComplete]);

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
    <QuestionBox
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSubmit={handleSubmit}
      onVote={handleVote}
      onMarkAnswered={handleMarkAnswered}
    />
  );
}
