import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import EmojiCheckIn, {
  type EmojiCheckInConfig,
  type EmojiCheckInState,
} from "./EmojiCheckIn";

const DEFAULT_CONFIG: EmojiCheckInConfig = {
  title: "表情打卡",
  question: "現在的心情/狀態是？",
  emojiOptions: ["😄", "🙂", "😐", "😴", "🤔", "😤", "🥳", "😰"],
  maxNoteLength: 60,
  noteRequired: false,
  showAuthor: true,
};

const DEFAULT_STATE: EmojiCheckInState = {
  entries: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function EmojiCheckInPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");

  const rawConfig = page.config as unknown;
  const config: EmojiCheckInConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: EmojiCheckInConfig }).config
      : (rawConfig as EmojiCheckInConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<EmojiCheckInState>({
    gameId,
    sessionId,
    pageId,
    type: "emoji_check_in",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-yellow-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    if (!selectedEmoji) return;
    const alreadyIn = state.entries.some((e) => e.userId === myUserId);
    if (alreadyIn) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      emoji: selectedEmoji,
      note: noteText.trim(),
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setSelectedEmoji(null);
    setNoteText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <EmojiCheckIn
      config={config}
      state={state}
      myUserId={myUserId}
      selectedEmoji={selectedEmoji}
      noteText={noteText}
      onSelectEmoji={setSelectedEmoji}
      onNoteChange={setNoteText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
