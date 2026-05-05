import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { TokenVote, TokenVoteConfig, TokenVoteState, TokenDistribution } from "./TokenVote";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: TokenVoteConfig = {
  title: "🪙 代幣投票",
  question: "請將代幣分配給你認為最重要的選項",
  options: ["選項 A", "選項 B", "選項 C"],
  totalTokens: 10,
};

function extractConfig(raw: Record<string, unknown>): TokenVoteConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    options:
      Array.isArray(raw.options) && raw.options.every((o) => typeof o === "string")
        ? (raw.options as string[])
        : DEFAULT_CONFIG.options,
    totalTokens:
      typeof raw.totalTokens === "number" ? raw.totalTokens : DEFAULT_CONFIG.totalTokens,
  };
}

const DEFAULT_STATE: TokenVoteState = { votes: [], revealed: false };

export default function TokenVotePage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<TokenVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "token_vote",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(distribution: number[]) {
    const already = state.votes.some((v: TokenDistribution) => v.userId === userId);
    if (already) return;
    const entry: TokenDistribution = {
      distId: `tv-${Date.now()}-${userId}`,
      userId,
      userName,
      distribution,
    };
    updateState({ ...state, votes: [...state.votes, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TokenVote
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
