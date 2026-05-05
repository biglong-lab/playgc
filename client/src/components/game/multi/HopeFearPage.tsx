import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import HopeFear, {
  type HopeFearConfig,
  type HopeFearState,
} from "./HopeFear";

const DEFAULT_CONFIG: HopeFearConfig = {
  title: "🌟⚡ 期待與擔憂",
  topic: "這個專案 / 計畫",
  hopeLabel: "期待",
  hopePrompt: "我希望能…",
  fearLabel: "擔憂",
  fearPrompt: "我擔心…",
  maxLength: 150,
  showAuthor: false,
};

const DEFAULT_STATE: HopeFearState = {
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

export default function HopeFearPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState({ hope: "", fear: "" });

  const rawConfig = page.config as unknown;
  const config: HopeFearConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: HopeFearConfig }).config
      : (rawConfig as HopeFearConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<HopeFearState>({
    gameId,
    sessionId,
    pageId,
    type: "hope_fear",
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

  function handleDraftChange(field: "hope" | "fear", value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!draft.hope.trim() || !draft.fear.trim()) return;
    const alreadySubmitted = state.entries.some((e) => e.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      hope: draft.hope.trim(),
      fear: draft.fear.trim(),
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraft({ hope: "", fear: "" });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <HopeFear
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
