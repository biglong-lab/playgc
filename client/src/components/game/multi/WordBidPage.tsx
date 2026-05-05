import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import WordBid, {
  type WordBidConfig,
  type WordBidState,
  type BidWord,
} from "./WordBid";

const DEFAULT_CONFIG: WordBidConfig = {
  title: "🏷️ 字詞競標",
  topic: "今天的活動",
  prompt: "用一個詞語代表這個主題！大家投票選最佳代言詞。",
  maxWordLength: 8,
  maxVotesPerPerson: 2,
};

const DEFAULT_STATE: WordBidState = {
  words: [],
  votes: [],
  phase: "submit",
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function WordBidPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftWord, setDraftWord] = useState("");

  const rawConfig = page.config as unknown;
  const config: WordBidConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: WordBidConfig }).config
      : (rawConfig as WordBidConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<WordBidState>({
    gameId,
    sessionId,
    pageId,
    type: "word_bid",
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

  function handleSubmitWord() {
    const trimmed = draftWord.trim();
    if (!trimmed || trimmed.length > config.maxWordLength) return;
    if (state.words.some((w) => w.userId === myUserId)) return;

    const newWord: BidWord = {
      wordId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      word: trimmed,
    };
    updateState({ ...state, words: [...state.words, newWord] });
    setDraftWord("");
  }

  function handleVote(wordId: string) {
    const myVotes = state.votes.filter((v) => v.voterId === myUserId);
    const alreadyVoted = myVotes.some((v) => v.wordId === wordId);

    if (alreadyVoted) {
      updateState({
        ...state,
        votes: state.votes.filter((v) => !(v.voterId === myUserId && v.wordId === wordId)),
      });
      return;
    }
    if (myVotes.length >= config.maxVotesPerPerson) return;

    const targetWord = state.words.find((w) => w.wordId === wordId);
    if (targetWord?.userId === myUserId) return;

    updateState({ ...state, votes: [...state.votes, { voterId: myUserId, wordId }] });
  }

  function handleAdvancePhase() {
    if (state.phase === "submit") {
      updateState({ ...state, phase: "vote" });
    } else if (state.phase === "vote") {
      updateState({ ...state, phase: "result" });
    }
  }

  return (
    <WordBid
      config={config}
      state={state}
      myUserId={myUserId}
      draftWord={draftWord}
      onDraftChange={setDraftWord}
      onSubmitWord={handleSubmitWord}
      onVote={handleVote}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
