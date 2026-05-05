import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { SentenceStem } from "./SentenceStem";
import type { SentenceStemConfig, SentenceStemState, StemEntry } from "./SentenceStem";

const DEFAULT_CONFIG: SentenceStemConfig = {
  title: "句子接龍",
  stemText: "如果我可以改變一件事，我會...",
  placeholder: "繼續這個句子...",
  maxLength: 80,
};

function extractConfig(raw: Record<string, unknown>): SentenceStemConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    stemText: typeof raw.stemText === "string" ? raw.stemText : DEFAULT_CONFIG.stemText,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : DEFAULT_CONFIG.placeholder,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
  };
}

const DEFAULT_STATE: SentenceStemState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SentenceStemPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<SentenceStemState>({
    gameId,
    sessionId,
    pageId,
    type: "sentence_stem",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(completion: string) {
    const entry: StemEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      completion,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <SentenceStem
      config={config}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      isLoaded={isLoaded}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}

export default SentenceStemPage;
