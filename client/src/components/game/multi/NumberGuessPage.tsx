import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import NumberGuess, {
  type NumberGuessConfig,
  type NumberGuessState,
} from "./NumberGuess";

const DEFAULT_CONFIG: NumberGuessConfig = {
  title: "🔢 數字競猜",
  question: "你每週花多少小時在開會上？",
  unit: "小時",
  minValue: 0,
  maxValue: 40,
  showAuthor: false,
};

const DEFAULT_STATE: NumberGuessState = {
  guesses: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function NumberGuessPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftValue, setDraftValue] = useState("");

  const rawConfig = page.config as unknown;
  const config: NumberGuessConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: NumberGuessConfig }).config
      : (rawConfig as NumberGuessConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<NumberGuessState>({
    gameId,
    sessionId,
    pageId,
    type: "number_guess",
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
    const numVal = parseFloat(draftValue);
    if (isNaN(numVal) || numVal < config.minValue || numVal > config.maxValue) return;
    const alreadySubmitted = state.guesses.some((g) => g.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      value: numVal,
    };
    updateState({ ...state, guesses: [...state.guesses, newEntry] });
    setDraftValue("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <NumberGuess
      config={config}
      state={state}
      myUserId={myUserId}
      draftValue={draftValue}
      onDraftChange={setDraftValue}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
