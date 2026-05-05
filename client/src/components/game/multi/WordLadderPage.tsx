import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import WordLadder, {
  type WordLadderConfig,
  type WordLadderState,
} from "./WordLadder";

const DEFAULT_CONFIG: WordLadderConfig = {
  title: "🔗 詞語接龍",
  prompt: "每人輪流接龍，下一個詞必須以上一個詞的最後一字開頭",
  startWord: "金門",
  maxWordLength: 10,
};

const DEFAULT_STATE: WordLadderState = {
  chain: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function WordLadderPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftWord, setDraftWord] = useState("");

  const rawConfig = page.config as unknown;
  const config: WordLadderConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: WordLadderConfig }).config
      : (rawConfig as WordLadderConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<WordLadderState>({
    gameId,
    sessionId,
    pageId,
    type: "word_ladder",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    const word = draftWord.trim();
    if (!word) return;
    const alreadySubmitted = state.chain.some((e) => e.userId === myUserId);
    if (alreadySubmitted) return;

    const lastWord = state.chain.length > 0
      ? state.chain[state.chain.length - 1].word
      : config.startWord;
    const requiredFirstChar = lastWord[lastWord.length - 1];
    if (word[0] !== requiredFirstChar) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      word,
    };
    updateState({ ...state, chain: [...state.chain, newEntry] });
    setDraftWord("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <WordLadder
      config={config}
      state={state}
      myUserId={myUserId}
      draftWord={draftWord}
      onDraftChange={setDraftWord}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
