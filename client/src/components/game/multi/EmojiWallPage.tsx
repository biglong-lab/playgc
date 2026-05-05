import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { EmojiWall, EmojiWallConfig, EmojiWallState, EmojiEntry } from "./EmojiWall";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: EmojiWallConfig = {
  title: "😊 表情牆",
  prompt: "用一個表情代表你現在的感受",
  emojis: ["😊", "😎", "🤔", "😅", "🔥", "💪", "😴", "🤩", "😰", "🥳"],
  reasonLabel: "為什麼選這個？（選填）",
  askReason: true,
};

function extractConfig(raw: Record<string, unknown>): EmojiWallConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    emojis:
      Array.isArray(raw.emojis) && raw.emojis.every((e) => typeof e === "string")
        ? (raw.emojis as string[])
        : DEFAULT_CONFIG.emojis,
    reasonLabel:
      typeof raw.reasonLabel === "string" ? raw.reasonLabel : DEFAULT_CONFIG.reasonLabel,
    askReason: typeof raw.askReason === "boolean" ? raw.askReason : DEFAULT_CONFIG.askReason,
  };
}

const DEFAULT_STATE: EmojiWallState = { entries: [], revealed: false };

export default function EmojiWallPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiWallState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_wall",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(emoji: string, reason: string) {
    const already = state.entries.some((e: EmojiEntry) => e.userId === userId);
    if (already) return;
    const entry: EmojiEntry = {
      entryId: `ew-${Date.now()}-${userId}`,
      userId,
      userName,
      emoji,
      reason,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <EmojiWall
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
