import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { NumberLine } from "./NumberLine";
import type { NumberLineConfig, NumberLineState, NumberPlacement } from "./NumberLine";

const DEFAULT_CONFIG: NumberLineConfig = {
  title: "數字定位",
  question: "你對目前的進度有幾分把握？",
  min: 1,
  max: 10,
  unit: "分",
  lowLabel: "完全不確定",
  highLabel: "完全有把握",
};

function extractConfig(raw: Record<string, unknown>): NumberLineConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : DEFAULT_CONFIG.title,
    question: typeof raw.question === "string" ? raw.question : DEFAULT_CONFIG.question,
    min: typeof raw.min === "number" ? raw.min : DEFAULT_CONFIG.min,
    max: typeof raw.max === "number" ? raw.max : DEFAULT_CONFIG.max,
    unit: typeof raw.unit === "string" ? raw.unit : DEFAULT_CONFIG.unit,
    lowLabel: typeof raw.lowLabel === "string" ? raw.lowLabel : DEFAULT_CONFIG.lowLabel,
    highLabel: typeof raw.highLabel === "string" ? raw.highLabel : DEFAULT_CONFIG.highLabel,
  };
}

const DEFAULT_STATE: NumberLineState = { placements: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function NumberLinePage({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";
  const config = extractConfig(rawConfig ?? DEFAULT_CONFIG);

  const { state, updateState, isLoaded } = useTeamPagePersistence<NumberLineState>({
    gameId,
    sessionId,
    pageId,
    type: "number_line",
    defaultState: DEFAULT_STATE,
  });

  function handleSubmit(value: number) {
    const placement: NumberPlacement = {
      placementId: `${userId}-${Date.now()}`,
      userId,
      userName,
      value,
    };
    updateState({ ...state, placements: [...state.placements, placement] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <NumberLine
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

export default NumberLinePage;
