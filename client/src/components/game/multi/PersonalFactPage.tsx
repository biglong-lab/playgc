import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import PersonalFact, {
  PersonalFactConfig,
  PersonalFactState,
  FactEntry,
} from "./PersonalFact";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

const DEFAULT_CONFIG: PersonalFactConfig = {
  title: "趣味自我揭秘",
  prompt: "說一個關於你自己、讓大家驚訝的小事",
  maxLength: 100,
  showAuthor: true,
};

const DEFAULT_STATE: PersonalFactState = {
  facts: [],
  revealed: false,
};

export default function PersonalFactPage({
  gameId,
  sessionId,
  pageId,
  page,
}: Props) {
  const { user } = useAuth();

  const raw = page?.config;
  const config: PersonalFactConfig =
    raw && typeof raw === "object" && "maxLength" in raw
      ? (raw as PersonalFactConfig)
      : raw && typeof raw === "object" && "config" in raw
      ? (raw as { config: PersonalFactConfig }).config
      : DEFAULT_CONFIG;

  const { state, updateState, isLoaded } =
    useTeamPagePersistence<PersonalFactState>({
      gameId,
      sessionId,
      pageId,
      type: "personal_fact",
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

  function handleSubmit(text: string) {
    if (state.facts.find((f: FactEntry) => f.userId === myUserId))
      return;
    const newFact: FactEntry = {
      factId: `fact-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      userId: myUserId,
      userName: myUserName,
      text,
      hearts: [],
    };
    updateState({ ...state, facts: [...state.facts, newFact] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleHeart(factId: string) {
    const updated = state.facts.map((f: FactEntry) => {
      if (f.factId !== factId) return f;
      if (f.userId === myUserId) return f;
      const already = f.hearts.includes(myUserId);
      return {
        ...f,
        hearts: already
          ? f.hearts.filter((h: string) => h !== myUserId)
          : [...f.hearts, myUserId],
      };
    });
    updateState({ ...state, facts: updated });
  }

  return (
    <PersonalFact
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
      onHeart={handleHeart}
    />
  );
}
