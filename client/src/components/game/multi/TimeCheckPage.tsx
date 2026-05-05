import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { TimeCheck, TimeCheckConfig, TimeCheckState, TimeCheckEntry } from "./TimeCheck";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: TimeCheckConfig = {
  title: "📍 進度回報",
  question: "你目前在哪個階段？",
  milestones: ["剛開始", "進行中", "快完成", "已完成"],
};

function extractConfig(raw: Record<string, unknown>): TimeCheckConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    milestones:
      Array.isArray(raw.milestones) && raw.milestones.every((m) => typeof m === "string")
        ? (raw.milestones as string[])
        : DEFAULT_CONFIG.milestones,
  };
}

const DEFAULT_STATE: TimeCheckState = { checks: [], revealed: false };

export default function TimeCheckPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<TimeCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "time_check",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(milestoneIndex: number) {
    const already = state.checks.some((c: TimeCheckEntry) => c.userId === userId);
    if (already) return;
    const entry: TimeCheckEntry = {
      checkId: `tc-${Date.now()}-${userId}`,
      userId,
      userName,
      milestoneIndex,
    };
    updateState({ ...state, checks: [...state.checks, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TimeCheck
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
