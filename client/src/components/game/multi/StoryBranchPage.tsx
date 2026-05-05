import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import StoryBranch, {
  StoryBranchConfig,
  StoryBranchState,
  BranchVote,
} from "./StoryBranch";

const DEFAULT_CONFIG: StoryBranchConfig = {
  title: "故事分支",
  segments: [],
};

const DEFAULT_STATE: StoryBranchState = {
  currentSegmentId: null,
  votes: [],
  history: [],
  phase: "voting",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): StoryBranchConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "segments" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("segments" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        segments: Array.isArray(src.segments)
          ? (src.segments as StoryBranchConfig["segments"])
          : DEFAULT_CONFIG.segments,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function StoryBranchPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<StoryBranchState>({
    gameId,
    sessionId,
    pageId,
    type: "story_branch",
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

  function handleStart() {
    const firstSegment = config.segments[0];
    if (!firstSegment) return;
    updateState({ ...state, currentSegmentId: firstSegment.segmentId });
  }

  function handleVote(choiceId: string) {
    const already = state.votes.find(
      (v) => v.userId === myUserId && v.segmentId === state.currentSegmentId
    );
    if (already) return;
    const newVote: BranchVote = {
      voteId: `${myUserId}-${state.currentSegmentId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      choiceId,
      segmentId: state.currentSegmentId ?? "",
    };
    updateState({ ...state, votes: [...state.votes, newVote] });
  }

  function handleAdvance(nextSegmentOrCurrent: string | null) {
    if (state.phase === "voting") {
      updateState({ ...state, phase: "result" });
      return;
    }
    if (state.phase === "result") {
      const newHistory = [...state.history, state.currentSegmentId!];
      if (!nextSegmentOrCurrent) {
        updateState({ ...state, history: newHistory, phase: "done" });
      } else {
        updateState({
          ...state,
          currentSegmentId: nextSegmentOrCurrent,
          history: newHistory,
          phase: "voting",
        });
      }
    }
  }

  return (
    <StoryBranch
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onAdvance={handleAdvance}
      onStart={handleStart}
    />
  );
}
