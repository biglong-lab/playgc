import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { IdeaMarket } from "./IdeaMarket";
import type { IdeaMarketConfig, IdeaMarketState, IdeaEntry } from "./IdeaMarket";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: IdeaMarketConfig = {
  title: "💡 創意市場",
  prompt: "提交你的點子並為最佳點子投票",
  voteLabel: "投票",
  votesPerPlayer: 3,
  maxLength: 80,
  submissionLabel: "提交你的點子",
};

function extractConfig(raw: Record<string, unknown>): IdeaMarketConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    voteLabel: typeof raw.voteLabel === "string" ? raw.voteLabel : DEFAULT_CONFIG.voteLabel,
    votesPerPlayer: typeof raw.votesPerPlayer === "number" ? raw.votesPerPlayer : DEFAULT_CONFIG.votesPerPlayer,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    submissionLabel: typeof raw.submissionLabel === "string" ? raw.submissionLabel : DEFAULT_CONFIG.submissionLabel,
  };
}

const DEFAULT_STATE: IdeaMarketState = { ideas: [], revealed: false };

export default function IdeaMarketPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<IdeaMarketState>({
    gameId,
    sessionId,
    pageId,
    type: "idea_market",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleSubmit(title: string, description: string) {
    const newIdea: IdeaEntry = {
      ideaId: `idea-${Date.now()}-${userId}`,
      userId,
      userName,
      title,
      description,
      votes: 0,
      voters: [],
    };
    updateState({ ...state, ideas: [...state.ideas, newIdea] });
  }

  function handleVote(ideaId: string) {
    const updated = state.ideas.map((idea: IdeaEntry) => {
      if (idea.ideaId !== ideaId) return idea;
      const voted = idea.voters.includes(userId);
      if (voted) {
        return { ...idea, votes: idea.votes - 1, voters: idea.voters.filter((v: string) => v !== userId) };
      }
      return { ...idea, votes: idea.votes + 1, voters: [...idea.voters, userId] };
    });
    updateState({ ...state, ideas: updated });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <IdeaMarket
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onSubmit={handleSubmit}
      onVote={handleVote}
      onReveal={handleReveal}
    />
  );
}
