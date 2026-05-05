import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { ScaleVote, ScaleVoteConfig, ScaleVoteState, ScaleVoteEntry } from "./ScaleVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: ScaleVoteConfig = {
  title: "📊 滑桿投票",
  question: "你的評分是？",
  minLabel: "完全不同意",
  maxLabel: "完全同意",
  scaleMin: 0,
  scaleMax: 100,
  defaultValue: 50,
};

function extractConfig(raw: Record<string, unknown>): ScaleVoteConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    minLabel: typeof raw.minLabel === "string" ? raw.minLabel : DEFAULT_CONFIG.minLabel,
    maxLabel: typeof raw.maxLabel === "string" ? raw.maxLabel : DEFAULT_CONFIG.maxLabel,
    scaleMin: typeof raw.scaleMin === "number" ? raw.scaleMin : DEFAULT_CONFIG.scaleMin,
    scaleMax: typeof raw.scaleMax === "number" ? raw.scaleMax : DEFAULT_CONFIG.scaleMax,
    defaultValue: typeof raw.defaultValue === "number" ? raw.defaultValue : DEFAULT_CONFIG.defaultValue,
  };
}

const DEFAULT_STATE: ScaleVoteState = { entries: [], revealed: false };

export default function ScaleVotePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<ScaleVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "scale_vote",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(value: number) {
    const already = state.entries.some((e: ScaleVoteEntry) => e.userId === userId);
    if (already) return;
    const entry: ScaleVoteEntry = {
      entryId: `sv-${Date.now()}-${userId}`,
      userId,
      userName,
      value,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ScaleVote
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
