import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import ThinkingHats, {
  type ThinkingHatsConfig,
  type ThinkingHatsState,
  DEFAULT_HATS,
} from "./ThinkingHats";

const DEFAULT_CONFIG: ThinkingHatsConfig = {
  title: "六頂思考帽",
  topic: "今天課程中最讓你印象深刻的一件事",
  hats: DEFAULT_HATS,
  maxLength: 120,
  showAuthor: true,
};

const DEFAULT_STATE: ThinkingHatsState = {
  thoughts: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function ThinkingHatsPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [selectedHatId, setSelectedHatId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const rawConfig = page.config as unknown;
  const config: ThinkingHatsConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: ThinkingHatsConfig }).config
      : (rawConfig as ThinkingHatsConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ThinkingHatsState>({
    gameId,
    sessionId,
    pageId,
    type: "thinking_hats",
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
    if (!selectedHatId || !draftText.trim()) return;
    const alreadySubmitted = state.thoughts.some((t) => t.userId === myUserId);
    if (alreadySubmitted) return;

    const newThought = {
      thoughtId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      hatId: selectedHatId,
      text: draftText.trim(),
    };
    updateState({ ...state, thoughts: [...state.thoughts, newThought] });
    setDraftText("");
    setSelectedHatId(null);
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ThinkingHats
      config={config}
      state={state}
      myUserId={myUserId}
      selectedHatId={selectedHatId}
      draftText={draftText}
      onSelectHat={setSelectedHatId}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
