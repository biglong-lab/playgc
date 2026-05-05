import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import EmojiReaction, {
  EmojiReactionConfig,
  EmojiReactionState,
  Reaction,
} from "./EmojiReaction";

const DEFAULT_CONFIG: EmojiReactionConfig = {
  title: "Emoji 情緒反應",
  prompt: "用一個 Emoji 表達你現在的感受",
  maxNote: 30,
};

const DEFAULT_STATE: EmojiReactionState = {
  reactions: [],
  revealed: false,
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): EmojiReactionConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "maxNote" in r
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("maxNote" in src) {
      return {
        title: (src.title as string) ?? DEFAULT_CONFIG.title,
        prompt: (src.prompt as string) ?? DEFAULT_CONFIG.prompt,
        maxNote: (src.maxNote as number) ?? DEFAULT_CONFIG.maxNote,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function EmojiReactionPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiReactionState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_reaction",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-pink-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmit(emoji: string, note: string) {
    const already = state.reactions.find((r) => r.userId === myUserId);
    if (already) return;
    const newReaction: Reaction = {
      reactionId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      emoji,
      note,
    };
    updateState({ ...state, reactions: [...state.reactions, newReaction] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <EmojiReaction
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
