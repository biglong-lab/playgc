import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { SkillMap, SkillMapConfig, SkillMapState, SkillEntry } from "./SkillMap";

interface SkillMapPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: SkillMapConfig = {
  title: "🗺️ 技能地圖",
  prompt: "告訴大家你能提供什麼、你需要什麼",
  offerLabel: "我能提供",
  needLabel: "我需要",
  maxLength: 80,
};

function extractConfig(raw: Record<string, unknown>): SkillMapConfig {
  if ("offerLabel" in raw && typeof raw.offerLabel === "string") {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      offerLabel: raw.offerLabel,
      needLabel: typeof raw.needLabel === "string" ? raw.needLabel : DEFAULT_CONFIG.needLabel,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function SkillMapPage({ gameId, sessionId, pageId, config }: SkillMapPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SkillMapState>({
    gameId,
    sessionId,
    pageId,
    type: "skill_map",
    defaultState: { maps: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-emerald-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (offer: string, need: string) => {
    const already = state.maps.find((m: SkillEntry) => m.userId === userId);
    if (already) return;
    updateState({
      ...state,
      maps: [
        ...state.maps,
        {
          mapId: `${userId}-${Date.now()}`,
          userId,
          userName,
          offer,
          need,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <SkillMap
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
