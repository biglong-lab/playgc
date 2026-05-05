import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import GlowGrow, {
  type GlowGrowConfig,
  type GlowGrowState,
} from "./GlowGrow";

const DEFAULT_CONFIG: GlowGrowConfig = {
  title: "✨🌱 閃光點 & 成長點",
  prompt: "回顧這段時間，寫下你個人的閃光點與想繼續成長的地方",
  glowLabel: "閃光點",
  glowPrompt: "我做得很好的是…",
  growLabel: "成長點",
  growPrompt: "我想繼續改善的是…",
  maxLength: 150,
  showAuthor: false,
};

const DEFAULT_STATE: GlowGrowState = {
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

export default function GlowGrowPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draft, setDraft] = useState({ glow: "", grow: "" });

  const rawConfig = page.config as unknown;
  const config: GlowGrowConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: GlowGrowConfig }).config
      : (rawConfig as GlowGrowConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<GlowGrowState>({
    gameId,
    sessionId,
    pageId,
    type: "glow_grow",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-emerald-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleDraftChange(field: "glow" | "grow", value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit() {
    if (!draft.glow.trim() || !draft.grow.trim()) return;
    const alreadySubmitted = state.entries.some((e) => e.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      glow: draft.glow.trim(),
      grow: draft.grow.trim(),
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraft({ glow: "", grow: "" });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <GlowGrow
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
