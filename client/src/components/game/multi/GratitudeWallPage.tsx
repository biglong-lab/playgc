import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GratitudeWall, {
  type GratitudeWallConfig,
  type GratitudeWallState,
  type GratitudeCard,
} from "./GratitudeWall";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface GratitudeWallPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: GratitudeWallConfig = {
  title: "💖 感恩塗鴉牆",
  prompt: "寫下你的感謝，讓溫暖傳遞！",
  placeholder: "感謝…",
  maxLength: 80,
  maxCardsPerPerson: 3,
  showAuthor: true,
  cardColors: ["bg-yellow-100", "bg-pink-100", "bg-blue-100", "bg-green-100", "bg-purple-100", "bg-orange-100"],
};

const DEFAULT_STATE: GratitudeWallState = { cards: [] };

const CARD_COLORS = ["bg-yellow-100", "bg-pink-100", "bg-blue-100", "bg-green-100", "bg-purple-100", "bg-orange-100"];

export default function GratitudeWallPage({ page, sessionId, gameId, pageId }: GratitudeWallPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: GratitudeWallConfig } | GratitudeWallConfig | null) ?? null;
  const config: GratitudeWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GratitudeWallConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<GratitudeWallState>({
    gameId,
    sessionId,
    pageId,
    type: "gratitude_wall",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");

  const handleAdd = useCallback(async () => {
    if (!draftText.trim()) return;
    const colorIdx = state.cards.length % CARD_COLORS.length;
    const newCard: GratitudeCard = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
      emoji: draftEmoji,
      color: CARD_COLORS[colorIdx] ?? "bg-yellow-100",
      hearts: [],
      addedAt: Date.now(),
    };
    await updateState({ ...state, cards: [...state.cards, newCard] });
    setDraftText("");
    setDraftEmoji("");
  }, [state, myUserId, myUserName, draftText, draftEmoji, updateState]);

  const handleHeart = useCallback(
    async (cardId: string) => {
      const updated = state.cards.map((card: GratitudeCard) => {
        if (card.id !== cardId) return card;
        const has = card.hearts.includes(myUserId);
        const newHearts = has
          ? card.hearts.filter((h) => h !== myUserId)
          : [...card.hearts, myUserId];
        return { ...card, hearts: newHearts };
      });
      await updateState({ ...state, cards: updated });
    },
    [state, myUserId, updateState],
  );

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
    <GratitudeWall
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      draftEmoji={draftEmoji}
      onTextChange={setDraftText}
      onEmojiChange={setDraftEmoji}
      onAdd={handleAdd}
      onHeart={handleHeart}
    />
  );
}
