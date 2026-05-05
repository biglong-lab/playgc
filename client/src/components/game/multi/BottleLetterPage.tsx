import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import BottleLetter, {
  type BottleLetterConfig,
  type BottleLetterState,
} from "./BottleLetter";

const DEFAULT_CONFIG: BottleLetterConfig = {
  title: "🍾 漂流瓶",
  prompt: "寫下一句話或一個心願，讓它漂向陌生人",
  maxLength: 200,
  showAuthor: false,
};

const DEFAULT_STATE: BottleLetterState = {
  letters: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function BottleLetterPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftText, setDraftText] = useState("");

  const rawConfig = page.config as unknown;
  const config: BottleLetterConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: BottleLetterConfig }).config
      : (rawConfig as BottleLetterConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<BottleLetterState>({
    gameId,
    sessionId,
    pageId,
    type: "bottle_letter",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleSubmit() {
    if (!draftText.trim()) return;
    const alreadySubmitted = state.letters.some((l) => l.userId === myUserId);
    if (alreadySubmitted) return;

    const newLetter = {
      letterId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
    };
    updateState({ ...state, letters: [...state.letters, newLetter] });
    setDraftText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <BottleLetter
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
