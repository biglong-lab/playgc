import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { PersonalScore, PersonalScoreConfig, PersonalScoreState, ScoreEntry } from "./PersonalScore";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: PersonalScoreConfig = {
  title: "⭐ 個人自評",
  prompt: "請對以下項目進行自我評分",
  criteria: ["溝通能力", "團隊合作", "問題解決", "創意思維"],
  maxScore: 5,
};

function extractConfig(raw: Record<string, unknown>): PersonalScoreConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    criteria:
      Array.isArray(raw.criteria) && raw.criteria.every((c) => typeof c === "string")
        ? (raw.criteria as string[])
        : DEFAULT_CONFIG.criteria,
    maxScore: typeof raw.maxScore === "number" ? raw.maxScore : DEFAULT_CONFIG.maxScore,
  };
}

const DEFAULT_STATE: PersonalScoreState = { scores: [], revealed: false };

export default function PersonalScorePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<PersonalScoreState>({
    gameId,
    sessionId,
    pageId,
    type: "personal_score",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(ratings: number[]) {
    const already = state.scores.some((s: ScoreEntry) => s.userId === userId);
    if (already) return;
    const entry: ScoreEntry = {
      scoreId: `ps-${Date.now()}-${userId}`,
      userId,
      userName,
      ratings,
    };
    updateState({ ...state, scores: [...state.scores, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <PersonalScore
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
