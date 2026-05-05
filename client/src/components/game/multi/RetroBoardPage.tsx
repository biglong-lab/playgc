import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import type { Page } from "@shared/schema";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import RetroBoard from "./RetroBoard";
import type { RetroBoardConfig, RetroBoardState, RetroCard } from "./RetroBoard";

const DEFAULT_CONFIG: RetroBoardConfig = {
  title: "📋 回顧版",
  prompt: "分享你對這次活動的想法",
  columns: [
    { id: "keep", label: "繼續做", emoji: "✅", color: "green" },
    { id: "stop", label: "停止做", emoji: "🛑", color: "red" },
    { id: "start", label: "開始做", emoji: "🚀", color: "blue" },
  ],
  maxCardsPerColumn: 3,
  allowVoting: true,
};

const DEFAULT_STATE: RetroBoardState = {
  cards: [],
  phase: "add",
  hostUserId: null,
};

interface Props {
  page: Page;
  pageId: string;
  sessionId: string;
  gameId: string;
  onComplete?: () => void;
}

export default function RetroBoardPage({ page, pageId, sessionId, gameId, onComplete }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: RetroBoardConfig } | RetroBoardConfig | null) ?? null;
  const config: RetroBoardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as RetroBoardConfig | null)) ??
    DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<RetroBoardState>({
    gameId,
    sessionId,
    pageId,
    type: "retro_board",
    defaultState: DEFAULT_STATE,
  });

  const [draftColumnId, setDraftColumnId] = useState(config.columns[0]?.id ?? "");
  const [draftText, setDraftText] = useState("");

  const handleAddCard = useCallback(async () => {
    if (!draftText.trim() || !draftColumnId) return;
    const myCount = state.cards.filter((c) => c.columnId === draftColumnId && c.userId === myUserId).length;
    if (myCount >= config.maxCardsPerColumn) return;

    const newCard: RetroCard = {
      id: `${myUserId}-${Date.now()}`,
      columnId: draftColumnId,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
      votes: [],
      addedAt: Date.now(),
    };
    const hostId = state.hostUserId ?? myUserId;
    await updateState({ ...state, cards: [...state.cards, newCard], hostUserId: hostId });
    setDraftText("");
  }, [draftText, draftColumnId, myUserId, myUserName, config.maxCardsPerColumn, state, updateState]);

  const handleVote = useCallback(
    async (cardId: string) => {
      const updated = state.cards.map((c) => {
        if (c.id !== cardId || c.userId === myUserId) return c;
        const alreadyVoted = c.votes.includes(myUserId);
        return {
          ...c,
          votes: alreadyVoted ? c.votes.filter((v) => v !== myUserId) : [...c.votes, myUserId],
        };
      });
      await updateState({ ...state, cards: updated });
    },
    [myUserId, state, updateState],
  );

  const handleAdvancePhase = useCallback(async () => {
    if (state.phase === "add") {
      await updateState({ ...state, phase: "vote" });
    } else if (state.phase === "vote") {
      await updateState({ ...state, phase: "done" });
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
    <RetroBoard
      config={config}
      state={state}
      myUserId={myUserId}
      draftColumnId={draftColumnId}
      draftText={draftText}
      onColumnSelect={setDraftColumnId}
      onTextChange={setDraftText}
      onAddCard={handleAddCard}
      onVote={handleVote}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
