import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { RandomPick, RandomPickConfig, RandomPickState, PickParticipant } from "./RandomPick";

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: RandomPickConfig = {
  title: "🎲 隨機抽選",
  prompt: "點擊報名參加抽選",
  pickCount: 1,
  joinLabel: "我要參加",
  pickLabel: "開始抽選",
};

function extractConfig(raw: Record<string, unknown>): RandomPickConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    prompt: typeof raw.prompt === "string" ? raw.prompt : DEFAULT_CONFIG.prompt,
    pickCount: typeof raw.pickCount === "number" ? raw.pickCount : DEFAULT_CONFIG.pickCount,
    joinLabel: typeof raw.joinLabel === "string" ? raw.joinLabel : DEFAULT_CONFIG.joinLabel,
    pickLabel: typeof raw.pickLabel === "string" ? raw.pickLabel : DEFAULT_CONFIG.pickLabel,
  };
}

const DEFAULT_STATE: RandomPickState = { participants: [], picks: [], drawn: false };

export default function RandomPickPage({ gameId, sessionId, pageId, config, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ? String(user.id) : "anonymous";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const resolvedConfig = extractConfig(config ?? {});

  const { state, updateState, isLoaded } = useTeamPagePersistence<RandomPickState>({
    gameId,
    sessionId,
    pageId,
    type: "random_pick",
    defaultState: DEFAULT_STATE,
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  function handleJoin() {
    const already = state.participants.some((p: PickParticipant) => p.userId === userId);
    if (already) return;
    const participant: PickParticipant = {
      participantId: `rp-${Date.now()}-${userId}`,
      userId,
      userName,
    };
    updateState({ ...state, participants: [...state.participants, participant] });
  }

  function handleDraw() {
    const n = resolvedConfig.pickCount;
    const shuffled = [...state.participants].sort(() => Math.random() - 0.5);
    const picks = shuffled.slice(0, n);
    updateState({ ...state, picks, drawn: true });
  }

  function handleReset() {
    updateState({ ...state, picks: [], drawn: false });
  }

  return (
    <RandomPick
      config={resolvedConfig}
      state={state}
      userId={userId}
      isTeamLead={isTeamLead}
      onJoin={handleJoin}
      onDraw={handleDraw}
      onReset={handleReset}
    />
  );
}
