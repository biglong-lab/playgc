import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { MoodBoard, MoodBoardConfig, MoodBoardState, MoodEntry } from "./MoodBoard";

interface MoodBoardPageProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
}

const DEFAULT_CONFIG: MoodBoardConfig = {
  title: "🎨 情緒看板",
  prompt: "選一個 emoji 代表你現在的心情，再加一句話",
  emojiPool: ["😊", "😌", "🤔", "😤", "😴", "🥳", "😰", "🔥", "💪", "🌈", "⚡", "🫶"],
  notePlaceholder: "說說為什麼...",
  maxLength: 60,
};

function extractConfig(raw: Record<string, unknown>): MoodBoardConfig {
  if ("emojiPool" in raw && Array.isArray(raw.emojiPool)) {
    return {
      title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
      prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
      emojiPool: raw.emojiPool as string[],
      notePlaceholder: typeof raw.notePlaceholder === "string" ? raw.notePlaceholder : DEFAULT_CONFIG.notePlaceholder,
      maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    };
  }
  if (raw.config && typeof raw.config === "object") {
    return extractConfig(raw.config as Record<string, unknown>);
  }
  return DEFAULT_CONFIG;
}

export default function MoodBoardPage({ gameId, sessionId, pageId, config }: MoodBoardPageProps) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const cfg = config ? extractConfig(config) : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<MoodBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "mood_board",
    defaultState: { entries: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  const handleSubmit = (emoji: string, note: string) => {
    const already = state.entries.find((e: MoodEntry) => e.userId === userId);
    if (already) return;
    updateState({
      ...state,
      entries: [
        ...state.entries,
        {
          boardId: `${userId}-${Date.now()}`,
          userId,
          userName,
          emoji,
          note,
        },
      ],
    });
  };

  const handleReveal = () => updateState({ ...state, revealed: true });

  return (
    <MoodBoard
      config={cfg}
      state={state}
      userId={userId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
