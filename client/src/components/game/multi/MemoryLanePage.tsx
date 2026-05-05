import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import MemoryLane, {
  type MemoryLaneConfig,
  type MemoryLaneState,
  type MemoryCard,
} from "./MemoryLane";

const DEFAULT_CONFIG: MemoryLaneConfig = {
  title: "💭 記憶走廊",
  question: "你最難忘的一個瞬間是什麼？",
  maxLength: 150,
  showAuthor: true,
};

const DEFAULT_STATE: MemoryLaneState = {
  memories: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function MemoryLanePage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftText, setDraftText] = useState("");

  const rawConfig = page.config as unknown;
  const config: MemoryLaneConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: MemoryLaneConfig }).config
      : (rawConfig as MemoryLaneConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<MemoryLaneState>({
    gameId,
    sessionId,
    pageId,
    type: "memory_lane",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-rose-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    const trimmed = draftText.trim();
    if (!trimmed || trimmed.length > config.maxLength) return;
    if (state.memories.some((m) => m.userId === myUserId)) return;

    const newMem: MemoryCard = {
      memId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: trimmed,
      hearts: [],
    };
    updateState({ ...state, memories: [...state.memories, newMem] });
    setDraftText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(memId: string) {
    const updated = state.memories.map((m) => {
      if (m.memId !== memId) return m;
      const already = m.hearts.includes(myUserId);
      return {
        ...m,
        hearts: already ? m.hearts.filter((h) => h !== myUserId) : [...m.hearts, myUserId],
      };
    });
    updateState({ ...state, memories: updated });
  }

  return (
    <MemoryLane
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
