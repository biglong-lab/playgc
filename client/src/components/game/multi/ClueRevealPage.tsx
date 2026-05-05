import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";
import ClueReveal, {
  ClueRevealConfig,
  ClueRevealState,
  ClueGuess,
} from "./ClueReveal";

const DEFAULT_CONFIG: ClueRevealConfig = {
  title: "解謎線索",
  clues: [],
  minCluesBeforeGuess: 1,
};

const DEFAULT_STATE: ClueRevealState = {
  revealedCount: 0,
  guesses: [],
  phase: "playing",
};

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  page: { config?: unknown };
}

function extractConfig(raw: unknown): ClueRevealConfig {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const src =
      "clues" in r && Array.isArray(r.clues)
        ? r
        : "config" in r && r.config && typeof r.config === "object"
        ? (r.config as Record<string, unknown>)
        : {};
    if ("clues" in src && Array.isArray((src as Record<string, unknown>).clues)) {
      const s = src as Record<string, unknown>;
      return {
        title: (s.title as string) ?? DEFAULT_CONFIG.title,
        clues: (s.clues as string[]) ?? DEFAULT_CONFIG.clues,
        minCluesBeforeGuess:
          (s.minCluesBeforeGuess as number) ?? DEFAULT_CONFIG.minCluesBeforeGuess,
      };
    }
  }
  return DEFAULT_CONFIG;
}

export default function ClueRevealPage({ gameId, sessionId, pageId, page }: Props) {
  const { user } = useAuth();
  const config = extractConfig(page.config);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ClueRevealState>({
    gameId,
    sessionId,
    pageId,
    type: "clue_reveal",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="animate-spin w-8 h-8 text-violet-500" />
      </div>
    );
  }

  const myUserId = user?.id ?? "";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  function handleGuess(text: string) {
    const already = state.guesses.find((g) => g.userId === myUserId);
    if (already) return;
    const newGuess: ClueGuess = {
      guessId: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text,
      afterClueCount: state.revealedCount,
      correct: null,
    };
    updateState({ ...state, guesses: [...state.guesses, newGuess] });
  }

  function handleRevealNext() {
    if (state.revealedCount >= config.clues.length) return;
    updateState({ ...state, revealedCount: state.revealedCount + 1 });
  }

  function handleMarkGuess(guessId: string, correct: boolean) {
    const updated = state.guesses.map((g: ClueGuess) =>
      g.guessId === guessId ? { ...g, correct } : g,
    );
    updateState({ ...state, guesses: updated });
  }

  function handleFinish() {
    updateState({ ...state, phase: "done" });
  }

  return (
    <ClueReveal
      config={config}
      state={state}
      myUserId={myUserId}
      onGuess={handleGuess}
      onRevealNext={handleRevealNext}
      onMarkGuess={handleMarkGuess}
      onFinish={handleFinish}
    />
  );
}
