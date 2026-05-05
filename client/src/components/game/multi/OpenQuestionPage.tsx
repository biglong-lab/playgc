import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import OpenQuestion from "./OpenQuestion";
import type { OpenQuestionConfig, OpenQuestionState, OpenAnswer } from "./OpenQuestion";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface OpenQuestionPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: OpenQuestionConfig = {
  title: "💬 開放提問",
  question: "你今天最大的收穫是什麼？",
  maxLength: 100,
  maxAnswersPerPerson: 1,
  showAuthor: true,
};

const DEFAULT_STATE: OpenQuestionState = { answers: [] };

export default function OpenQuestionPage({ page, sessionId, gameId, pageId }: OpenQuestionPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: OpenQuestionConfig } | OpenQuestionConfig | null) ?? null;
  const config: OpenQuestionConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as OpenQuestionConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<OpenQuestionState>({
    gameId,
    sessionId,
    pageId,
    type: "open_question",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handleDraftChange = useCallback((text: string) => {
    setDraftText(text);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = draftText.trim();
    if (!trimmed || !myUserId) return;
    const myAnswersCount = state.answers.filter((a: OpenAnswer) => a.authorId === myUserId).length;
    if (myAnswersCount >= config.maxAnswersPerPerson) return;
    const newAnswer: OpenAnswer = {
      id: `${myUserId}-${Date.now()}`,
      text: trimmed,
      authorId: myUserId,
      authorName: myUserName,
      submittedAt: Date.now(),
    };
    await updateState({ ...state, answers: [...state.answers, newAnswer] });
    setDraftText("");
  }, [draftText, myUserId, myUserName, state, updateState, config.maxAnswersPerPerson]);

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
    <OpenQuestion
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={handleDraftChange}
      onSubmit={handleSubmit}
    />
  );
}
