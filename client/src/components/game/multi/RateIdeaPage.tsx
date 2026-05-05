import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import RateIdea, {
  RateIdeaConfig,
  RateIdeaState,
  IdeaRating,
} from "./RateIdea";

const DEFAULT_CONFIG: RateIdeaConfig = {
  title: "想法評分",
  prompt: "為每個想法評分（1-5 星）",
  ideas: [],
};

const DEFAULT_STATE: RateIdeaState = {
  ratings: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): RateIdeaConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "ideas" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("ideas" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        ideas: (src.ideas as RateIdeaConfig["ideas"]) ?? DEFAULT_CONFIG.ideas,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function RateIdeaPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<RateIdeaState>({
    gameId,
    sessionId,
    pageId,
    type: "rate_idea",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-amber-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleRate(ideaId: string, score: number) {
    const existing = state.ratings.find(
      (r) => r.userId === myUserId && r.ideaId === ideaId,
    );
    if (existing) {
      const updated = state.ratings.map((r) =>
        r.ratingId === existing.ratingId ? { ...r, score } : r,
      );
      updateState({ ...state, ratings: updated });
    } else {
      const newRating: IdeaRating = {
        ratingId: `${myUserId}-${ideaId}-${Date.now()}`,
        userId: myUserId,
        userName: myUserName,
        ideaId,
        score,
      };
      updateState({ ...state, ratings: [...state.ratings, newRating] });
    }
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <RateIdea
      config={config}
      state={state}
      myUserId={myUserId}
      onRate={handleRate}
      onReveal={handleReveal}
    />
  );
}
