import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import FeedbackSandwich, {
  type FeedbackSandwichConfig,
  type FeedbackSandwichState,
} from "./FeedbackSandwich";

const DEFAULT_CONFIG: FeedbackSandwichConfig = {
  title: "三明治反饋",
  targetName: "今天的訓練課程",
  goodPrompt: "最有價值的是…",
  betterPrompt: "可以改善的是…",
  goPrompt: "我接下來會…",
  maxLength: 150,
  showAuthor: false,
};

const DEFAULT_STATE: FeedbackSandwichState = {
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

export default function FeedbackSandwichPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState({ good: "", better: "", go: "" });

  const rawConfig = page.config as unknown;
  const config: FeedbackSandwichConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: FeedbackSandwichConfig }).config
      : (rawConfig as FeedbackSandwichConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<FeedbackSandwichState>({
    gameId,
    sessionId,
    pageId,
    type: "feedback_sandwich",
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

  function handleDraftChange(field: "good" | "better" | "go", value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!draft.good.trim() || !draft.better.trim() || !draft.go.trim()) return;
    const alreadySubmitted = state.entries.some((e) => e.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      good: draft.good.trim(),
      better: draft.better.trim(),
      go: draft.go.trim(),
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraft({ good: "", better: "", go: "" });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <FeedbackSandwich
      config={config}
      state={state}
      myUserId={myUserId}
      draft={draft}
      onDraftChange={handleDraftChange}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
