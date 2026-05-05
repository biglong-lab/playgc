import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import WordAssociation, {
  type WordAssociationConfig,
  type WordAssociationState,
} from "./WordAssociation";

const DEFAULT_CONFIG: WordAssociationConfig = {
  title: "自由聯想",
  words: ["金門", "海邊", "旅行", "回憶"],
  maxResponseLength: 20,
  showAuthor: true,
};

const DEFAULT_STATE: WordAssociationState = {
  responses: [],
  currentWordIndex: 0,
  revealedUpTo: 0,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function WordAssociationPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftResponse, setDraftResponse] = useState("");

  const rawConfig = page.config as unknown;
  const config: WordAssociationConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: WordAssociationConfig }).config
      : (rawConfig as WordAssociationConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<WordAssociationState>({
    gameId,
    sessionId,
    pageId,
    type: "word_association",
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
    if (!draftResponse.trim()) return;
    const alreadyResponded = state.responses.some(
      (r) => r.userId === myUserId && r.wordIndex === state.currentWordIndex
    );
    if (alreadyResponded) return;

    const newResponse = {
      responseId: `${myUserId}-${state.currentWordIndex}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      wordIndex: state.currentWordIndex,
      response: draftResponse.trim(),
    };
    updateState({ ...state, responses: [...state.responses, newResponse] });
    setDraftResponse("");
  }

  function handleReveal() {
    updateState({ ...state, revealedUpTo: state.currentWordIndex + 1 });
  }

  function handleNext() {
    const nextIndex = state.currentWordIndex + 1;
    updateState({ ...state, currentWordIndex: nextIndex, revealedUpTo: nextIndex });
    setDraftResponse("");
  }

  return (
    <WordAssociation
      config={config}
      state={state}
      myUserId={myUserId}
      draftResponse={draftResponse}
      onDraftChange={setDraftResponse}
      onSubmitResponse={handleSubmit}
      onReveal={handleReveal}
      onNext={handleNext}
    />
  );
}
