import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { FutureIdea, FutureIdeaConfig, FutureIdeaState } from "./FutureIdea";

interface FutureIdeaPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: FutureIdeaConfig = {
  title: "未來願景",
  prompt: "描述你對未來的想法與期待",
  horizon: "一年後",
  maxLength: 200,
};

function extractConfig(raw: Record<string, unknown>): FutureIdeaConfig {
  if ("horizon" in raw && typeof raw.horizon === "string") {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      horizon: raw.horizon,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function FutureIdeaPage({ gameId, sessionId, pageId, config }: FutureIdeaPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<FutureIdeaState>({
    gameId,
    sessionId,
    pageId,
    type: "future_idea",
    defaultState: { visions: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-purple-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (text: string) => {
    const already = state.visions.find((v: { userId: string }) => v.userId === userId);
    if (already) return;
    updateState({
      ...state,
      visions: [
        ...state.visions,
        {
          visionId: `${userId}-${Date.now()}`,
          userId,
          userName,
          text,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <FutureIdea
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
