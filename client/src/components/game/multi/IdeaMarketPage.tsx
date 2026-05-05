import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import IdeaMarket, {
  IdeaMarketConfig,
  IdeaMarketState,
  MarketIdea,
  TokenAlloc,
} from "./IdeaMarket";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: IdeaMarketConfig = {
  title: "創意市集",
  prompt: "用一句話說出你的創意點子",
  tokenBudget: 5,
  maxIdeaLength: 80,
  showAuthor: true,
};

const DEFAULT_STATE: IdeaMarketState = {
  ideas: [],
  allocations: [],
  phase: "pitch",
};

export default function IdeaMarketPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: IdeaMarketConfig =
    raw && typeof raw === "object" && "tokenBudget" in raw
      ? (raw as IdeaMarketConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: IdeaMarketConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<IdeaMarketState>({
      gameId,
      sessionId,
      pageId,
      type: "idea_market",
      defaultState: DEFAULT_STATE,
    });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-slate-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName =
    user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleSubmitIdea(text: string) {
    if (state.ideas.find((i: MarketIdea) => i.userId === myUserId))
      return;
    const newIdea: MarketIdea = {
      ideaId: `idea-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      text,
    };
    updateState({ ...state, ideas: [...state.ideas, newIdea] });
  }

  function handleInvest(ideaId: string, delta: number) {
    const tokenBudget =
      config.tokenBudget ?? DEFAULT_CONFIG.tokenBudget;
    const existing = state.allocations.find(
      (a: TokenAlloc) =>
        a.investorId === myUserId && a.ideaId === ideaId
    );
    const currentTokens = existing?.tokens ?? 0;
    const newTokens = Math.max(0, currentTokens + delta);
    const myTotal = state.allocations
      .filter(
        (a: TokenAlloc) =>
          a.investorId === myUserId && a.ideaId !== ideaId
      )
      .reduce((s: number, a: TokenAlloc) => s + a.tokens, 0);
    if (delta > 0 && myTotal + newTokens > tokenBudget) return;
    const withoutOld = state.allocations.filter(
      (a: TokenAlloc) =>
        !(a.investorId === myUserId && a.ideaId === ideaId)
    );
    const updated =
      newTokens > 0
        ? [
            ...withoutOld,
            {
              investorId: myUserId,
              ideaId,
              tokens: newTokens,
            },
          ]
        : withoutOld;
    updateState({ ...state, allocations: updated });
  }

  function handleAdvancePhase() {
    const next: IdeaMarketState["phase"] =
      state.phase === "pitch" ? "invest" : "result";
    updateState({ ...state, phase: next });
  }

  return (
    <IdeaMarket
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmitIdea={handleSubmitIdea}
      onInvest={handleInvest}
      onAdvancePhase={handleAdvancePhase}
    />
  );
}
