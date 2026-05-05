import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { TeamManifesto } from "./TeamManifesto";
import type { TeamManifestoConfig, TeamManifestoState, ManifestoEntry } from "./TeamManifesto";

const DEFAULT_CONFIG: TeamManifestoConfig = {
  title: "團隊宣言",
  stem: "我們是一個...",
  placeholder: "輸入一個關鍵詞或短句",
  maxLength: 20,
  maxPerUser: 3,
};

function extractConfig(raw: Record<string, unknown>): TeamManifestoConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    stem: typeof raw.stem === "string" ? raw.stem : DEFAULT_CONFIG.stem,
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : DEFAULT_CONFIG.placeholder,
    maxLength: typeof raw.maxLength === "number" ? raw.maxLength : DEFAULT_CONFIG.maxLength,
    maxPerUser: typeof raw.maxPerUser === "number" ? raw.maxPerUser : DEFAULT_CONFIG.maxPerUser,
  };
}

const DEFAULT_STATE: TeamManifestoState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamManifestoPage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamManifestoState>({
    gameId,
    sessionId,
    pageId,
    type: "team_manifesto",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(phrase: string) {
    const entry: ManifestoEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      phrase,
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <TeamManifesto
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

export default TeamManifestoPage;
