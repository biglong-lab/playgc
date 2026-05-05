import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { ValueCard, ValueCardConfig, ValueCardState, ValueSelection } from "./ValueCard";

interface ValueCardPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: ValueCardConfig = {
  title: "🃏 價值卡選單",
  prompt: "從以下卡片中選出最重要的幾張",
  cardPool: ["誠信", "創新", "團隊合作", "顧客導向", "卓越", "學習成長", "責任", "多元包容"],
  maxSelect: 3,
};

function extractConfig(raw: Record<string, unknown>): ValueCardConfig {
  if ("cardPool" in raw && Array.isArray(raw.cardPool)) {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      cardPool: raw.cardPool as string[],
      maxSelect: typeof raw.maxSelect === "number" ? raw.maxSelect : DEFAULT_CONFIG.maxSelect,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function ValueCardPage({ gameId, sessionId, pageId, config }: ValueCardPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ValueCardState>({
    gameId,
    sessionId,
    pageId,
    type: "value_card",
    defaultState: { selections: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-violet-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (cards: string[]) => {
    const already = state.selections.find((s: ValueSelection) => s.userId === userId);
    if (already) return;
    updateState({
      ...state,
      selections: [
        ...state.selections,
        {
          selectionId: `${userId}-${Date.now()}`,
          userId,
          userName,
          cards,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <ValueCard
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
