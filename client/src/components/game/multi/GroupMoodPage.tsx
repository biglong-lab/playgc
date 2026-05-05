import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import GroupMood, {
  GroupMoodConfig,
  GroupMoodState,
  MoodRating,
} from "./GroupMood";

const DEFAULT_CONFIG: GroupMoodConfig = {
  title: "團隊能量儀表",
  prompt: "現在你的能量/心情如何？",
  minLabel: "很低落",
  maxLabel: "超亢奮",
};

const DEFAULT_STATE: GroupMoodState = { ratings: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): GroupMoodConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "prompt" in r && !("config" in r)
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("minLabel" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        minLabel: (src.minLabel as string) ?? DEFAULT_CONFIG.minLabel,
        maxLabel: (src.maxLabel as string) ?? DEFAULT_CONFIG.maxLabel,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function GroupMoodPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupMoodState>({
    gameId,
    sessionId,
    pageId,
    type: "group_mood",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-blue-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(value: number) {
    const already = state.ratings.find((r) => r.userId === myUserId);
    if (already) return;
    const newRating: MoodRating = {
      ratingId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      value,
    };
    updateState({ ...state, ratings: [...state.ratings, newRating] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <GroupMood
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
