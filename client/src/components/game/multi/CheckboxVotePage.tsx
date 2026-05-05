import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import CheckboxVote, { CheckboxVoteConfig, CheckboxVoteState, MultiChoiceVote } from "./CheckboxVote";
import type { Page } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface Props {
  gameId: string;
  sessionId: string;
  page: Page & { config?: unknown };
  pageId: string;
}

const DEFAULT_STATE: CheckboxVoteState = { votes: [], revealed: false };

export default function CheckboxVotePage({ gameId, sessionId, page, pageId }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<CheckboxVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "checkbox_vote",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) return <Loader2 className="animate-spin m-auto mt-20" />;

  const raw = page.config ?? page;
  const r = raw as Record<string, unknown>;
  const config: CheckboxVoteConfig =
    "maxChoices" in r && typeof r.maxChoices === "number"
      ? (r as unknown as CheckboxVoteConfig)
      : r.config && "maxChoices" in (r.config as Record<string, unknown>)
        ? (r.config as unknown as CheckboxVoteConfig)
        : { title: "☑️ 複選投票", question: "請選擇所有符合的選項", options: ["選項 A", "選項 B", "選項 C"], maxChoices: 3 };

  const myUserId = user?.id ? String(user.id) : "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleVote(choices: number[]) {
    const already = state.votes.some((v) => v.userId === myUserId);
    if (already) return;
    const vote: MultiChoiceVote = {
      voteId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName,
      choices,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CheckboxVote
      config={config}
      state={state}
      myUserId={myUserId}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
