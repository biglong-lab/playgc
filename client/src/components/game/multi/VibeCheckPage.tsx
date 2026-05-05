import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { VibeCheck } from "./VibeCheck";
import type { VibeCheckConfig, VibeCheckState, VibeEntry } from "./VibeCheck";

const DEFAULT_CONFIG: VibeCheckConfig = {
  title: "氛圍感測",
  prompt: "請在每個維度上標記你的感受（0 = 低，100 = 高）",
  dimensions: [
    { id: "energy", label: "能量", lowEmoji: "😴", highEmoji: "⚡" },
    { id: "focus", label: "專注", lowEmoji: "🌀", highEmoji: "🎯" },
    { id: "connect", label: "連結", lowEmoji: "🤐", highEmoji: "🤝" },
    { id: "confidence", label: "信心", lowEmoji: "😟", highEmoji: "💪" },
  ],
};

function extractConfig(raw: Record<string, unknown>): VibeCheckConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    dimensions: Array.isArray(raw.dimensions)
      ? (raw.dimensions as VibeCheckConfig["dimensions"])
      : DEFAULT_CONFIG.dimensions,
  };
}

const DEFAULT_STATE: VibeCheckState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function VibeCheckPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<VibeCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "vibe_check",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(scores: Record<string, number>) {
    const entry: VibeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      scores,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <VibeCheck
      config={config}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      isLoaded={isLoaded}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}

export default VibeCheckPage;
