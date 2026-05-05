import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import RankChoice, {
  RankChoiceConfig,
  RankChoiceState,
  PlayerRanking,
} from "./RankChoice";

const DEFAULT_CONFIG: RankChoiceConfig = {
  title: "排序投票",
  question: "請依你的偏好排列順序",
  items: [],
};

const DEFAULT_STATE: RankChoiceState = {
  rankings: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): RankChoiceConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "items" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("items" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        question: (src.question as string) ?? DEFAULT_CONFIG.question,
        items: Array.isArray(src.items)
          ? (src.items as RankChoiceConfig["items"])
          : DEFAULT_CONFIG.items,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function RankChoicePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<RankChoiceState>({
    gameId,
    sessionId,
    pageId,
    type: "rank_choice",
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

  function handleSubmit(order: string[]) {
    const already = state.rankings.find((r) => r.userId === myUserId);
    if (already) return;
    const newRanking: PlayerRanking = {
      rankingId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      order,
    };
    updateState({ ...state, rankings: [...state.rankings, newRanking] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <RankChoice
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
