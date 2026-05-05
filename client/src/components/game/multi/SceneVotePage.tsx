import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import SceneVote, {
  SceneVoteConfig,
  SceneVoteState,
  SceneVoteRecord,
} from "./SceneVote";

const DEFAULT_CONFIG: SceneVoteConfig = {
  title: "場景選擇",
  question: "你是哪一種人？",
  scenes: [],
};

const DEFAULT_STATE: SceneVoteState = {
  votes: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): SceneVoteConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "scenes" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("scenes" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        question: (src.question as string) ?? DEFAULT_CONFIG.question,
        scenes: Array.isArray(src.scenes) ? (src.scenes as SceneVoteConfig["scenes"]) : DEFAULT_CONFIG.scenes,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function SceneVotePage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<SceneVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "scene_vote",
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

  function handleVote(sceneId: string) {
    const already = state.votes.find((v) => v.userId === myUserId);
    if (already) return;
    const newVote: SceneVoteRecord = {
      voteId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      sceneId,
    };
    updateState({ ...state, votes: [...state.votes, newVote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <SceneVote
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
