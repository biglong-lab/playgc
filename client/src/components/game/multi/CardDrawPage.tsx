import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CardDraw from "./CardDraw";
import type { CardDrawConfig, CardDrawState, PlayerDraw } from "./CardDraw";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CardDrawPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: CardDrawConfig = {
  title: "🎴 抽牌任務",
  cards: [
    { cardId: "c1", label: "破冰發問者", emoji: "🎤", description: "負責提出第一個問題" },
    { cardId: "c2", label: "記錄者", emoji: "📝", description: "負責記錄討論重點" },
    { cardId: "c3", label: "時間守護者", emoji: "⏱️", description: "負責提醒時間" },
    { cardId: "c4", label: "魔鬼代言人", emoji: "😈", description: "負責提出反對意見" },
    { cardId: "c5", label: "總結者", emoji: "🎯", description: "負責最後整理結論" },
  ],
  allowReveal: true,
};

const DEFAULT_STATE: CardDrawState = {
  draws: [],
  revealed: false,
};

export default function CardDrawPage({ page, sessionId, gameId, pageId }: CardDrawPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: CardDrawConfig } | CardDrawConfig | null) ?? null;
  const config: CardDrawConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CardDrawConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CardDrawState>({
    gameId,
    sessionId,
    pageId,
    type: "card_draw",
    defaultState: DEFAULT_STATE,
  });

  const handleDraw = useCallback(async () => {
    const already = state.draws.some((d: PlayerDraw) => d.userId === myUserId);
    if (already || config.cards.length === 0) return;
    // 隨機抽一張（避開已被抽走的）
    const takenIds = state.draws.map((d: PlayerDraw) => d.cardId);
    const available = config.cards.filter((c) => !takenIds.includes(c.cardId));
    const pool = available.length > 0 ? available : config.cards;
    const drawn = pool[Math.floor(Math.random() * pool.length)];
    const newDraw: PlayerDraw = { userId: myUserId, userName: myUserName, cardId: drawn.cardId };
    await updateState({ ...state, draws: [...state.draws, newDraw] });
  }, [state, myUserId, myUserName, config.cards, updateState]);

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <CardDraw
      config={config}
      state={state}
      myUserId={myUserId}
      onDraw={handleDraw}
      onReveal={handleReveal}
    />
  );
}
