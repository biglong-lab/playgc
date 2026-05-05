import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import TwoTruths from "./TwoTruths";
import type { TwoTruthsConfig, TwoTruthsState, PlayerStatements, TwoTruthsGuess } from "./TwoTruths";

const DEFAULT_CONFIG: TwoTruthsConfig = {
  title: "🤥 兩真一假",
  instructions: "寫下 2 個真實陳述和 1 個謊言，讓大家猜哪個是假的！",
  showScores: true,
};

const DEFAULT_STATE: TwoTruthsState = {
  phase: "collect",
  entries: [],
  guesses: [],
  hostUserId: null,
};

interface Props {
  page: Page;
  pageId: string;
  sessionId: string;
  gameId: string;
  onComplete?: () => void;
}

export default function TwoTruthsPage({ page, pageId, sessionId, gameId, onComplete }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: TwoTruthsConfig } | TwoTruthsConfig | null) ?? null;
  const config: TwoTruthsConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TwoTruthsConfig | null)) ??
    DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TwoTruthsState>({
    gameId,
    sessionId,
    pageId,
    type: "two_truths",
    defaultState: DEFAULT_STATE,
  });

  const [drafts, setDrafts] = useState(["", "", ""]);
  const [lieDraftIdx, setLieDraftIdx] = useState(2);

  const handleDraftChange = useCallback((idx: number, value: string) => {
    setDrafts((prev) => prev.map((v, i) => (i === idx ? value : v)));
  }, []);

  const handleLieSelect = useCallback((idx: number) => {
    setLieDraftIdx(idx);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (drafts.some((d) => !d.trim())) return;
    const newEntry: PlayerStatements = {
      userId: myUserId,
      userName: myUserName,
      statements: drafts.map((d) => d.trim()),
      lieIdx: lieDraftIdx,
      submittedAt: Date.now(),
    };
    const existing = state.entries.filter((e) => e.userId !== myUserId);
    const hostId = state.hostUserId ?? (existing.length === 0 ? myUserId : state.hostUserId);
    await updateState({ ...state, entries: [...existing, newEntry], hostUserId: hostId });
  }, [drafts, lieDraftIdx, myUserId, myUserName, state, updateState]);

  const handleGuess = useCallback(
    async (targetUserId: string, guessedIdx: number) => {
      if (targetUserId === myUserId) return;
      const existing = state.guesses.filter(
        (g) => !(g.guesserId === myUserId && g.targetUserId === targetUserId),
      );
      const newGuess: TwoTruthsGuess = { guesserId: myUserId, targetUserId, guessedIdx };
      await updateState({ ...state, guesses: [...existing, newGuess] });
    },
    [myUserId, state, updateState],
  );

  const handleAdvancePhase = useCallback(async () => {
    if (state.phase === "collect") {
      await updateState({ ...state, phase: "guess" });
    } else if (state.phase === "guess") {
      await updateState({ ...state, phase: "reveal" });
      if (onComplete) onComplete();
    }
  }, [state, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-40">
        <Loader2 className="animate-spin text-slate-400" size={28} />
      </div>
    );
  }

  return (
    <TwoTruths
      config={config}
      state={state}
      myUserId={myUserId}
      drafts={drafts}
      lieDraftIdx={lieDraftIdx}
      onDraftChange={handleDraftChange}
      onLieSelect={handleLieSelect}
      onSubmit={handleSubmit}
      onGuess={handleGuess}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
