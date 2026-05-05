import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { StandPoint, StandPointConfig, StandPointState, StandPosition } from "./StandPoint";

interface StandPointPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: StandPointConfig = {
  title: "🗣️ 立場陳述",
  issue: "你對這個議題的看法？",
  stances: ["支持", "中立", "反對"],
  reasonLabel: "說明你的理由",
  maxLength: 150,
};

function extractConfig(raw: Record<string, unknown>): StandPointConfig {
  if ("stances" in raw && Array.isArray(raw.stances) && "issue" in raw) {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      issue: typeof raw.issue === "string" ? raw.issue : DEFAULT_CONFIG.issue,
      stances: raw.stances as string[],
      reasonLabel: typeof raw.reasonLabel === "string" ? raw.reasonLabel : DEFAULT_CONFIG.reasonLabel,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function StandPointPage({ gameId, sessionId, pageId, config }: StandPointPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<StandPointState>({
    gameId,
    sessionId,
    pageId,
    type: "stand_point",
    defaultState: { positions: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (stance: string, reason: string) => {
    const already = state.positions.find((p: StandPosition) => p.userId === userId);
    if (already) return;
    updateState({
      ...state,
      positions: [
        ...state.positions,
        {
          posId: `${userId}-${Date.now()}`,
          userId,
          userName,
          stance,
          reason,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <StandPoint
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
