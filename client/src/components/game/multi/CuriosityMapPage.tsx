import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { CuriosityMap } from "./CuriosityMap";
import type { CuriosityMapConfig, CuriosityMapState, CuriosityEntry } from "./CuriosityMap";

const DEFAULT_CONFIG: CuriosityMapConfig = {
  title: "好奇心地圖",
  prompt: "你目前最想深入了解的問題或主題是什麼？",
  placeholder: "輸入你的好奇心問題...",
  maxLength: 80,
};

function extractConfig(raw: Record<string, unknown>): CuriosityMapConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : DEFAULT_CONFIG.placeholder,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
  };
}

const DEFAULT_STATE: CuriosityMapState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function CuriosityMapPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<CuriosityMapState>({
    gameId,
    sessionId,
    pageId,
    type: "curiosity_map",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(question: string) {
    const entry: CuriosityEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      question,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <CuriosityMap
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

export default CuriosityMapPage;
