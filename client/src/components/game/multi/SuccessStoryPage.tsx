import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { SuccessStory, SuccessStoryConfig, SuccessStoryState, SuccessEntry } from "./SuccessStory";

interface SuccessStoryPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: SuccessStoryConfig = {
  title: "🏆 成功故事牆",
  prompt: "分享最近一個讓你感到驕傲的小成就",
  achievementLabel: "成就名稱",
  detailLabel: "故事細節（可選）",
  maxLength: 150,
};

function extractConfig(raw: Record<string, unknown>): SuccessStoryConfig {
  if ("achievementLabel" in raw && typeof raw.achievementLabel === "string") {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      achievementLabel: raw.achievementLabel,
      detailLabel: typeof raw.detailLabel === "string" ? raw.detailLabel : DEFAULT_CONFIG.detailLabel,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function SuccessStoryPage({ gameId, sessionId, pageId, config }: SuccessStoryPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SuccessStoryState>({
    gameId,
    sessionId,
    pageId,
    type: "success_story",
    defaultState: { stories: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-yellow-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (achievement: string, detail: string) => {
    const already = state.stories.find((s: SuccessEntry) => s.userId === userId);
    if (already) return;
    const entry: SuccessEntry = {
      storyId: `${userId}-${Date.now()}`,
      userId,
      userName,
      achievement,
      detail,
    };
    updateState({ ...state, stories: [...state.stories, entry] });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <SuccessStory
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
