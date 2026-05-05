import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import ValueRank, {
  type ValueRankConfig,
  type ValueRankState,
} from "./ValueRank";

const DEFAULT_ITEMS = ["創意", "效率", "協作", "誠信", "學習"];

const DEFAULT_CONFIG: ValueRankConfig = {
  title: "🏆 價值排序",
  prompt: "請依重要性排列以下價值觀（最重要放第一）",
  items: DEFAULT_ITEMS,
  showAuthor: false,
};

const DEFAULT_STATE: ValueRankState = {
  rankings: [],
  revealed: false,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function ValueRankPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: ValueRankConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: ValueRankConfig }).config
      : (rawConfig as ValueRankConfig | null) ?? DEFAULT_CONFIG;

  const [draftOrder, setDraftOrder] = useState<string[]>([...config.items]);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ValueRankState>({
    gameId,
    sessionId,
    pageId,
    type: "value_rank",
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
    const alreadySubmitted = state.rankings.some((r) => r.userId === myUserId);
    if (alreadySubmitted) return;

    const newEntry = {
      entryId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      order: [...draftOrder],
    };
    updateState({ ...state, rankings: [...state.rankings, newEntry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <ValueRank
      config={config}
      state={state}
      myUserId={myUserId}
      draftOrder={draftOrder}
      onOrderChange={setDraftOrder}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
