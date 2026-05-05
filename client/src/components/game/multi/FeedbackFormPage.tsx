import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import FeedbackForm, { FeedbackFormConfig, FeedbackFormState, FeedbackScore } from "./FeedbackForm";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: FeedbackFormState = { scores: [], revealed: false };

export default function FeedbackFormPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FeedbackFormState>({
    gameId,
    sessionId,
    pageId,
    type: "feedback_form",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: FeedbackFormConfig =
    "dimensions" in r && Array.isArray(r.dimensions)
      ? (r as unknown as FeedbackFormConfig)
      : r.config && "dimensions" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as FeedbackFormConfig)
        : { title: "回饋單", prompt: "請對以下各項進行評分", dimensions: ["內容", "講師", "環境"] };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(scores: Record<string, number>) {
    const already = state.scores.some((s) => s.userId === myUserId);
    if (already) return;
    const entry: FeedbackScore = {
      scoreId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      scores,
    };
    updateState({ ...state, scores: [...state.scores, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <FeedbackForm
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
