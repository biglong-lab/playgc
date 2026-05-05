import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import GroupDecision, { GroupDecisionConfig, GroupDecisionState, DecisionVote } from "./GroupDecision";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: GroupDecisionState = { votes: [], revealed: false };

export default function GroupDecisionPage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupDecisionState>({
    gameId,
    sessionId,
    pageId,
    type: "group_decision",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: GroupDecisionConfig =
    "question" in r && "options" in r && Array.isArray(r.options)
      ? (r as unknown as GroupDecisionConfig)
      : r.config && "question" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as GroupDecisionConfig)
        : { title: "群體決策", question: "你選哪個？", options: ["選項 A", "選項 B", "選項 C"] };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleVote(choice: string) {
    const already = state.votes.some((v) => v.userId === myUserId);
    if (already) return;
    const vote: DecisionVote = {
      voteId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      choice,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <GroupDecision
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
