import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { ConsensusMap } from "./ConsensusMap";
import type { ConsensusMapConfig, ConsensusMapState, ConsensusMapEntry } from "./ConsensusMap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: ConsensusMapConfig = {
  title: "🗺️ 共識地圖",
  prompt: "評估各選項的可行性與重要性",
  topics: ["選項 A", "選項 B", "選項 C"],
  xLabel: "可行性",
  yLabel: "重要性",
  axisMin: 1,
  axisMax: 5,
};

function extractConfig(raw: Record<string, unknown>): ConsensusMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    topics: Array.isArray(raw.topics) ? (raw.topics as string[]) : DEFAULT_CONFIG.topics,
    xLabel: typeof raw.xLabel === "string" ? raw.xLabel : DEFAULT_CONFIG.xLabel,
    yLabel: typeof raw.yLabel === "string" ? raw.yLabel : DEFAULT_CONFIG.yLabel,
    axisMin: typeof raw.axisMin === "number" ? raw.axisMin : DEFAULT_CONFIG.axisMin,
    axisMax: typeof raw.axisMax === "number" ? raw.axisMax : DEFAULT_CONFIG.axisMax,
  };
}

const DEFAULT_STATE: ConsensusMapState = { entries: [], revealed: false };

export default function ConsensusMapPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<ConsensusMapState>({
    gameId,
    sessionId,
    pageId,
    type: "consensus_map",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(topic: string, feasibility: number, importance: number) {
    const entry: ConsensusMapEntry = {
      entryId: `cm-${Date.now()}-${userId}`,
      userId,
      userName,
      topic,
      feasibility,
      importance,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ConsensusMap
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
