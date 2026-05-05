import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SilentBrainstorm from "./SilentBrainstorm";
import type { SilentBrainstormConfig, SilentBrainstormState, BrainIdea } from "./SilentBrainstorm";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface SilentBrainstormPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: SilentBrainstormConfig = {
  title: "🧠 靜默腦力激盪",
  question: "如何提升團隊協作效率？",
  maxLength: 100,
  maxIdeasPerPerson: 3,
  showAuthor: false,
};

const DEFAULT_STATE: SilentBrainstormState = {
  ideas: [],
  revealed: false,
};

export default function SilentBrainstormPage({ page, sessionId, gameId, pageId }: SilentBrainstormPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: SilentBrainstormConfig } | SilentBrainstormConfig | null) ?? null;
  const config: SilentBrainstormConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as SilentBrainstormConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SilentBrainstormState>({
    gameId,
    sessionId,
    pageId,
    type: "silent_brainstorm",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!draftText.trim()) return;
    const myCount = state.ideas.filter((i: BrainIdea) => i.userId === myUserId).length;
    if (myCount >= config.maxIdeasPerPerson) return;
    const newIdea: BrainIdea = {
      ideaId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      content: draftText.trim(),
      votes: [],
    };
    await updateState({ ...state, ideas: [...state.ideas, newIdea] });
    setDraftText("");
  }, [draftText, state, myUserId, myUserName, config.maxIdeasPerPerson, updateState]);

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

  const handleVote = useCallback(
    async (ideaId: string) => {
      if (!state.revealed) return;
      const updated = state.ideas.map((idea: BrainIdea) => {
        if (idea.ideaId !== ideaId) return idea;
        const already = idea.votes.includes(myUserId);
        return {
          ...idea,
          votes: already
            ? idea.votes.filter((v: string) => v !== myUserId)
            : [...idea.votes, myUserId],
        };
      });
      await updateState({ ...state, ideas: updated });
    },
    [state, myUserId, updateState]
  );

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <SilentBrainstorm
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onVote={handleVote}
    />
  );
}
