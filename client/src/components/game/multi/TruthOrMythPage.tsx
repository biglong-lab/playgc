import React from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";
import TruthOrMyth, {
  type TruthOrMythConfig,
  type TruthOrMythState,
} from "./TruthOrMyth";

const DEFAULT_CONFIG: TruthOrMythConfig = {
  title: "真偽大考驗",
  statements: [
    { stmtId: "s1", text: "人類只使用了大腦的 10%", isTrue: false },
    { stmtId: "s2", text: "章魚有三顆心臟", isTrue: true },
    { stmtId: "s3", text: "玻璃是液體，只是流動非常慢", isTrue: false },
  ],
};

const DEFAULT_STATE: TruthOrMythState = {
  votes: [],
  currentIndex: 0,
  revealedUpTo: 0,
};

interface Props {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: () => void;
}

export default function TruthOrMythPage({ page, sessionId, gameId, pageId }: Props) {
  const { user } = useAuth();

  const rawConfig = page.config as unknown;
  const config: TruthOrMythConfig =
    rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: TruthOrMythConfig }).config
      : (rawConfig as TruthOrMythConfig | null) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TruthOrMythState>({
    gameId,
    sessionId,
    pageId,
    type: "truth_or_myth",
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
  const currentStmt = config.statements[state.currentIndex];

  function handleVote(answer: "truth" | "myth") {
    if (!currentStmt) return;
    const alreadyVoted = state.votes.some(
      (v) => v.userId === myUserId && v.stmtId === currentStmt.stmtId
    );
    if (alreadyVoted) return;

    const newVote = {
      userId: myUserId,
      userName: myUserName,
      stmtId: currentStmt.stmtId,
      answer,
    };
    updateState({ ...state, votes: [...state.votes, newVote] });
  }

  function handleReveal() {
    updateState({ ...state, revealedUpTo: state.currentIndex + 1 });
  }

  function handleNext() {
    const nextIndex = state.currentIndex + 1;
    updateState({ ...state, currentIndex: nextIndex, revealedUpTo: nextIndex });
  }

  return (
    <TruthOrMyth
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onNext={handleNext}
      onReveal={handleReveal}
    />
  );
}
