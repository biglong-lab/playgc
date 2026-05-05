import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import CrowdAnswer, {
  CrowdAnswerConfig,
  CrowdAnswerState,
  CrowdGuess,
} from "./CrowdAnswer";

const DEFAULT_CONFIG: CrowdAnswerConfig = {
  title: "猜猜看",
  question: "你的答案是？",
  unit: "",
  correctAnswer: 0,
};

const DEFAULT_STATE: CrowdAnswerState = {
  guesses: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): CrowdAnswerConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "correctAnswer" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("correctAnswer" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        question: (src.question as string) ?? DEFAULT_CONFIG.question,
        unit: (src.unit as string) ?? DEFAULT_CONFIG.unit,
        correctAnswer: typeof src.correctAnswer === "number" ? src.correctAnswer : DEFAULT_CONFIG.correctAnswer,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function CrowdAnswerPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<CrowdAnswerState>({
    gameId,
    sessionId,
    pageId,
    type: "crowd_answer",
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

  function handleSubmit(value: number) {
    const already = state.guesses.find((g) => g.userId === myUserId);
    if (already) return;
    const newGuess: CrowdGuess = {
      guessId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      value,
    };
    updateState({ ...state, guesses: [...state.guesses, newGuess] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CrowdAnswer
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
