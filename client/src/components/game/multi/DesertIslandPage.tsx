import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import DesertIsland, {
  type DesertIslandConfig,
  type DesertIslandState,
  type DesertEntry,
} from "./DesertIsland";

const DEFAULT_CONFIG: DesertIslandConfig = {
  title: "🏝 無人島帶什麼？",
  scenario: "如果你要在無人島上生活一年，只能帶 3 樣東西，你會帶什麼？",
  numItems: 3,
  maxItemLength: 30,
  showAuthor: true,
};

const DEFAULT_STATE: DesertIslandState = {
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

export default function DesertIslandPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: DesertIslandConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: DesertIslandConfig }).config
      : (rawConfig as DesertIslandConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<DesertIslandState>({
    gameId,
    sessionId,
    pageId,
    type: "desert_island",
    defaultState: DEFAULT_STATE,
  });

  const [draftItems, setDraftItems] = useState<string[]>(
    Array.from({ length: config.numItems }, () => "")
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-indigo-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "anon";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  function handleDraftChange(idx: number, value: string) {
    setDraftItems((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }

  function handleSubmit() {
    const trimmed = draftItems.map((v) => v.trim());
    const valid =
      trimmed.length === config.numItems &&
      trimmed.every((v) => v.length > 0 && v.length <= config.maxItemLength);
    if (!valid) return;
    const alreadySubmitted = state.entries.some((e) => e.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry: DesertEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      items: trimmed,
    };
    updateState({ ...state, entries: [...state.entries, newEntry] });
    setDraftItems(Array.from({ length: config.numItems }, () => ""));
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <DesertIsland
      config={config}
      state={state}
      myUserId={myUserId}
      draftItems={draftItems}
      onDraftChange={handleDraftChange}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
