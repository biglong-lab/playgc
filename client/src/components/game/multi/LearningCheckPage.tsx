import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { LearningCheck, LearningCheckConfig, LearningCheckState, LearningCheckEntry } from "./LearningCheck";

interface LearningCheckPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: LearningCheckConfig = {
  title: "📊 學習確認",
  prompt: "對今天學到的主題，評估自己的掌握程度",
  topics: ["概念理解", "實作能力", "應用情境"],
  selfRateLabel: "掌握度 1-5",
  maxLength: 100,
};

function extractConfig(raw: Record<string, unknown>): LearningCheckConfig {
  if ("selfRateLabel" in raw && typeof raw.selfRateLabel === "string") {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      topics: Array.isArray(raw.topics) ? raw.topics as string[] : DEFAULT_CONFIG.topics,
      selfRateLabel: raw.selfRateLabel,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function LearningCheckPage({ gameId, sessionId, pageId, config }: LearningCheckPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<LearningCheckState>({
    gameId,
    sessionId,
    pageId,
    type: "learning_check",
    defaultState: { checks: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (ratings: Record<string, number>, note: string) => {
    const already = state.checks.find((c: LearningCheckEntry) => c.userId === userId);
    if (already) return;
    updateState({
      ...state,
      checks: [
        ...state.checks,
        {
          checkId: `${userId}-${Date.now()}`,
          userId,
          userName,
          ratings,
          note,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <LearningCheck
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
