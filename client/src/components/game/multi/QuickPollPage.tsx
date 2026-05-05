import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { QuickPoll, QuickPollConfig, QuickPollState, PollVote } from "./QuickPoll";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: QuickPollConfig = {
  title: "📊 快速民調",
  question: "請選擇你的答案",
  options: ["選項 A", "選項 B", "選項 C"],
  maxLength: 40,
};

function extractConfig(raw: Record<string, unknown>): QuickPollConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    options: Array.isArray(raw.options) ? (raw.options as string[]) : DEFAULT_CONFIG.options,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
  };
}

const DEFAULT_STATE: QuickPollState = { votes: [], revealed: false };

export default function QuickPollPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<QuickPollState>({
    gameId,
    sessionId,
    pageId,
    type: "quick_poll",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleVote(option: string) {
    const already = state.votes.some((v: PollVote) => v.userId === userId);
    if (already) return;
    const vote: PollVote = {
      voteId: `qp-${Date.now()}-${userId}`,
      userId,
      userName,
      option,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <QuickPoll
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
