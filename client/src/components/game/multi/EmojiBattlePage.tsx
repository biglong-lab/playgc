import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import EmojiBattle, {
  type EmojiBattleConfig,
  type EmojiBattleState,
  type EmojiVote,
} from "./EmojiBattle";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface EmojiBattlePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: EmojiBattleConfig = {
  title: "🎭 Emoji 表情大戰",
  question: "現在你的心情是？",
  emojis: [
    { emoji: "😄", label: "超開心" },
    { emoji: "😎", label: "很酷" },
    { emoji: "🤔", label: "在想" },
    { emoji: "😴", label: "有點累" },
    { emoji: "🔥", label: "超燃" },
    { emoji: "💪", label: "準備好了" },
  ],
  allowMultiSelect: false,
  showResults: true,
};

const DEFAULT_STATE: EmojiBattleState = { votes: [] };

export default function EmojiBattlePage({ page, sessionId, gameId, pageId }: EmojiBattlePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: EmojiBattleConfig } | EmojiBattleConfig | null) ?? null;
  const config: EmojiBattleConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as EmojiBattleConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiBattleState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_battle",
    defaultState: DEFAULT_STATE,
  });

  const handleSelect = useCallback(
    async (emoji: string) => {
      const existing = state.votes.find((v) => v.userId === myUserId);

      let newEmojis: string[];
      if (config.allowMultiSelect) {
        const currentEmojis = existing?.emojis ?? [];
        newEmojis = currentEmojis.includes(emoji)
          ? currentEmojis.filter((e) => e !== emoji)
          : [...currentEmojis, emoji];
      } else {
        const current = existing?.emojis ?? [];
        newEmojis = current.includes(emoji) ? [] : [emoji];
      }

      const newVote: EmojiVote = {
        userId: myUserId,
        userName: myUserName,
        emojis: newEmojis,
        votedAt: Date.now(),
      };

      const updatedVotes = existing
        ? state.votes.map((v) => (v.userId === myUserId ? newVote : v))
        : [...state.votes, newVote];

      await updateState({ ...state, votes: updatedVotes });
    },
    [state, myUserId, myUserName, config.allowMultiSelect, updateState],
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
    <EmojiBattle
      config={config}
      state={state}
      myUserId={myUserId}
      onSelect={handleSelect}
    />
  );
}
