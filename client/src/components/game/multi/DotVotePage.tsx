import { useState, useCallback, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import DotVote from "./DotVote";
import type { DotVoteConfig, DotVoteState, DotAllocation } from "./DotVote";

const DEFAULT_CONFIG: DotVoteConfig = {
  title: "🔵 點點投票",
  question: "選出你最重視的選項（可分散）",
  options: [
    { id: "o1", label: "選項 A", emoji: "🅰️" },
    { id: "o2", label: "選項 B", emoji: "🅱️" },
    { id: "o3", label: "選項 C", emoji: "🆑" },
  ],
  dotsPerPerson: 3,
  showResultsLive: true,
};

const DEFAULT_STATE: DotVoteState = { allocations: [] };

interface Props {
  page: Page;
  pageId: string;
  sessionId: string;
  gameId: string;
  onComplete?: () => void;
}

export default function DotVotePage({ page, pageId, sessionId, gameId, onComplete }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: DotVoteConfig } | DotVoteConfig | null) ?? null;
  const config =
    rawConfig && "config" in rawConfig
      ? (rawConfig.config ?? DEFAULT_CONFIG)
      : ((rawConfig as DotVoteConfig | null) ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<DotVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "dot_vote",
    defaultState: DEFAULT_STATE,
  });

  const [draft, setDraft] = useState<Record<string, number>>(() =>
    Object.fromEntries(config.options.map((o) => [o.id, 0])),
  );

  const myAllocation = state.allocations.find((a) => a.userId === myUserId);
  const hasSubmitted = !!myAllocation;
  const usedDots = Object.values(draft).reduce((s, n) => s + n, 0);
  const remainingDots = config.dotsPerPerson - usedDots;

  useEffect(() => {
    if (hasSubmitted && onComplete) onComplete();
  }, [hasSubmitted, onComplete]);

  const handleAdd = useCallback(
    (optionId: string) => {
      if (remainingDots <= 0) return;
      setDraft((prev) => ({ ...prev, [optionId]: (prev[optionId] ?? 0) + 1 }));
    },
    [remainingDots],
  );

  const handleRemove = useCallback((optionId: string) => {
    setDraft((prev) => ({ ...prev, [optionId]: Math.max(0, (prev[optionId] ?? 0) - 1) }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (hasSubmitted || remainingDots !== 0) return;
    const newAlloc: DotAllocation = {
      userId: myUserId,
      userName: myUserName,
      allocations: config.options.map((opt) => ({
        optionId: opt.id,
        count: draft[opt.id] ?? 0,
      })),
      submittedAt: Date.now(),
    };
    const existing = state.allocations.filter((a) => a.userId !== myUserId);
    await updateState({ allocations: [...existing, newAlloc] });
  }, [hasSubmitted, remainingDots, myUserId, myUserName, config.options, draft, state.allocations, updateState]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <DotVote
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      draft={draft}
      remainingDots={remainingDots}
      onAdd={handleAdd}
      onRemove={handleRemove}
      onSubmit={handleSubmit}
    />
  );
}
