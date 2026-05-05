import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import CollectivePoem, {
  type CollectivePoemConfig,
  type CollectivePoemState,
} from "./CollectivePoem";

const DEFAULT_CONFIG: CollectivePoemConfig = {
  title: "📜 集體詩",
  prompt: "每人加入一行，共同寫一首詩",
  starter: "在那遙遠的地方，",
  maxLength: 50,
  showAuthor: false,
  maxLinesPerUser: 1,
};

const DEFAULT_STATE: CollectivePoemState = {
  lines: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function CollectivePoemPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();
  const [draftLine, setDraftLine] = useState("");

  const rawConfig = page.config as unknown;
  const config: CollectivePoemConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: CollectivePoemConfig }).config
      : (rawConfig as CollectivePoemConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CollectivePoemState>({
    gameId,
    sessionId,
    pageId,
    type: "collective_poem",
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
    if (!draftLine.trim()) return;
    const myLineCount = state.lines.filter((l) => l.userId === myUserId).length;
    if (myLineCount >= config.maxLinesPerUser) return;

    const newLine = {
      lineId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftLine.trim(),
    };
    updateState({ ...state, lines: [...state.lines, newLine] });
    setDraftLine("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CollectivePoem
      config={config}
      state={state}
      myUserId={myUserId}
      draftLine={draftLine}
      onDraftChange={setDraftLine}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
