import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import AudienceQ, {
  AudienceQConfig,
  AudienceQState,
  AudQuestion,
} from "./AudienceQ";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: AudienceQConfig = {
  title: "現場提問",
  prompt: "有什麼想問的嗎？",
  maxLength: 100,
  showAuthor: true,
};

const DEFAULT_STATE: AudienceQState = { questions: [] };

export default function AudienceQPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: AudienceQConfig =
    raw && typeof raw === "object" && "maxLength" in raw
      ? (raw as AudienceQConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: AudienceQConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<AudienceQState>({
      gameId,
      sessionId,
      pageId,
      type: "audience_q",
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

  function handleSubmitQuestion(text: string) {
    const newQ: AudQuestion = {
      questionId: `q-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      text,
      votes: [],
      answered: false,
    };
    updateState({
      ...state,
      questions: [...state.questions, newQ],
    });
  }

  function handleUpvote(questionId: string) {
    const updated = state.questions.map((q: AudQuestion) => {
      if (q.questionId !== questionId) return q;
      if (q.userId === myUserId) return q;
      const hasVoted = q.votes.includes(myUserId);
      return {
        ...q,
        votes: hasVoted
          ? q.votes.filter((v: string) => v !== myUserId)
          : [...q.votes, myUserId],
      };
    });
    updateState({ ...state, questions: updated });
  }

  function handleMarkAnswered(questionId: string) {
    const updated = state.questions.map((q: AudQuestion) => {
      if (q.questionId !== questionId) return q;
      return { ...q, answered: true };
    });
    updateState({ ...state, questions: updated });
  }

  return (
    <AudienceQ
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitQuestion={handleSubmitQuestion}
      onUpvote={handleUpvote}
      onMarkAnswered={handleMarkAnswered}
    />
  );
}
