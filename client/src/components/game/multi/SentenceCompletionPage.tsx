import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import SentenceCompletion, {
  type SentenceCompletionConfig,
  type SentenceCompletionState,
} from "./SentenceCompletion";

const DEFAULT_CONFIG: SentenceCompletionConfig = {
  title: "句子接龍",
  starter: "我認為這次活動…",
  maxLength: 80,
  maxPerPerson: 1,
  reactions: ["❤️", "😂", "👏"],
  showAuthor: true,
};

const DEFAULT_STATE: SentenceCompletionState = {
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

export default function SentenceCompletionPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftText, setDraftText] = useState("");

  const rawConfig = page.config as unknown;
  const config: SentenceCompletionConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: SentenceCompletionConfig }).config
      : (rawConfig as SentenceCompletionConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SentenceCompletionState>({
    gameId,
    sessionId,
    pageId,
    type: "sentence_completion",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-purple-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    if (!draftText.trim()) return;
    const myEntries = state.entries.filter((e) => e.userId === myUserId);
    if (myEntries.length >= config.maxPerPerson) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
      reactions: {} as Record<string, string[]>,
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraftText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleReact(entryId: string, emoji: string) {
    const updatedEntries = state.entries.map((e) => {
      if (e.entryId !== entryId) return e;
      const voters = e.reactions[emoji] ?? [];
      const alreadyVoted = voters.includes(myUserId);
      const newVoters = alreadyVoted
        ? voters.filter((id) => id !== myUserId)
        : [...voters, myUserId];
      return { ...e, reactions: { ...e.reactions, [emoji]: newVoters } };
    });
    updateState({ ...state, entries: updatedEntries });
  }

  return (
    <SentenceCompletion
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onReact={handleReact}
    />
  );
}
