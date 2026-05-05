import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import SkillSwap, { SkillSwapConfig, SkillSwapState, SkillCard } from "./SkillSwap";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: SkillSwapConfig = {
  title: "技能交換牆",
  offerPrompt: "我能提供什麼？",
  wantPrompt: "我想學什麼？",
  maxLength: 20,
  showAuthor: true,
};

const DEFAULT_STATE: SkillSwapState = {
  cards: [],
  revealed: false,
};

export default function SkillSwapPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const rawConfig = page?.config;
  const config: SkillSwapConfig =
    rawConfig && typeof rawConfig === "object" && "offerPrompt" in rawConfig
      ? (rawConfig as SkillSwapConfig)
      : rawConfig && typeof rawConfig === "object" && "config" in rawConfig
      ? (rawConfig as { config: SkillSwapConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<SkillSwapState>({
    gameId,
    sessionId,
    pageId,
    type: "skill_swap",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="animate-spin w-6 h-6 text-teal-500" />
      </div>
    );
  }

  function handleSubmit(offerSkill: string, wantSkill: string) {
    const newCard: SkillCard = {
      cardId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      offerSkill,
      wantSkill,
      hearts: [],
    };
    updateState({ ...state, cards: [...state.cards, newCard] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(cardId: string) {
    const updated = state.cards.map((c: SkillCard) => {
      if (c.cardId !== cardId) return c;
      const already = c.hearts.includes(myUserId);
      return {
        ...c,
        hearts: already ? c.hearts.filter((h: string) => h !== myUserId) : [...c.hearts, myUserId],
      };
    });
    updateState({ ...state, cards: updated });
  }

  return (
    <SkillSwap
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
