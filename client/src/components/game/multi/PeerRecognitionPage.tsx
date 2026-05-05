// 🌟 PeerRecognitionPage — pageType="peer_recognition" 容器（L3 持久化）
import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PeerRecognition, {
  type PeerRecognitionConfig,
  type PeerRecognitionState,
  type RecognitionCard,
} from "./PeerRecognition";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PeerRecognitionPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PeerRecognitionConfig = {
  title: "🌟 同伴表揚牆",
  prompt: "寫下你想感謝的人",
  placeholder: "感謝你在這次活動中…",
  maxLength: 100,
  allowAnonymous: true,
  emojiOptions: ["🌟", "🙌", "💪", "❤️", "👏", "🎉", "🔥", "💡", "🤝", "✨"],
};

const DEFAULT_STATE: PeerRecognitionState = { cards: [] };

export default function PeerRecognitionPage({ page, sessionId, gameId, pageId }: PeerRecognitionPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PeerRecognitionConfig } | PeerRecognitionConfig | null) ?? null;
  const config: PeerRecognitionConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PeerRecognitionConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PeerRecognitionState>({
    gameId,
    sessionId,
    pageId,
    type: "peer_recognition",
    defaultState: DEFAULT_STATE,
  });

  const [draftTo, setDraftTo] = useState("");
  const [draftMessage, setDraftMessage] = useState("");
  const [draftEmoji, setDraftEmoji] = useState("");
  const [draftAnonymous, setDraftAnonymous] = useState(false);

  const handleSubmit = useCallback(async () => {
    if (!draftTo.trim() || !draftMessage.trim() || !draftEmoji) return;
    const newCard: RecognitionCard = {
      id: `${myUserId}-${Date.now()}`,
      fromUserId: myUserId,
      fromUserName: myUserName,
      toName: draftTo.trim(),
      message: draftMessage.trim(),
      emoji: draftEmoji,
      hearts: [],
      addedAt: Date.now(),
      anonymous: draftAnonymous,
    };
    await updateState({ ...state, cards: [...state.cards, newCard] });
    setDraftTo("");
    setDraftMessage("");
    setDraftEmoji("");
    setDraftAnonymous(false);
  }, [state, myUserId, myUserName, draftTo, draftMessage, draftEmoji, draftAnonymous, updateState]);

  const handleHeart = useCallback(
    async (cardId: string) => {
      const updatedCards = state.cards.map((c: RecognitionCard) => {
        if (c.id !== cardId || c.fromUserId === myUserId) return c;
        const hasHearted = c.hearts.includes(myUserId);
        const newHearts = hasHearted
          ? c.hearts.filter((h) => h !== myUserId)
          : [...c.hearts, myUserId];
        return { ...c, hearts: newHearts };
      });
      await updateState({ ...state, cards: updatedCards });
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
    <PeerRecognition
      config={config}
      state={state}
      myUserId={myUserId}
      draftTo={draftTo}
      draftMessage={draftMessage}
      draftEmoji={draftEmoji}
      draftAnonymous={draftAnonymous}
      onToChange={setDraftTo}
      onMessageChange={setDraftMessage}
      onEmojiChange={setDraftEmoji}
      onAnonymousChange={setDraftAnonymous}
      onSubmit={handleSubmit}
      onHeart={handleHeart}
    />
  );
}
