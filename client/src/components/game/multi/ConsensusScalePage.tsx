// 📊 ConsensusScalePage — pageType="consensus_scale" 容器（L3 持久化）
import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ConsensusScale, {
  type ConsensusScaleConfig,
  type ConsensusScaleState,
  type ScaleResponse,
} from "./ConsensusScale";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface ConsensusScalePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: ConsensusScaleConfig = {
  title: "📊 共識量表",
  question: "你對這個提案的支持程度？",
  scaleMin: 1,
  scaleMax: 5,
  minLabel: "完全不同意",
  maxLabel: "完全同意",
  showAverage: true,
  showDistribution: true,
};

const DEFAULT_STATE: ConsensusScaleState = { responses: [] };

export default function ConsensusScalePage({ page, sessionId, gameId, pageId }: ConsensusScalePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: ConsensusScaleConfig } | ConsensusScaleConfig | null) ?? null;
  const config: ConsensusScaleConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as ConsensusScaleConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ConsensusScaleState>({
    gameId,
    sessionId,
    pageId,
    type: "consensus_scale",
    defaultState: DEFAULT_STATE,
  });

  const handleSelect = useCallback(
    async (value: number) => {
      const newResponse: ScaleResponse = {
        userId: myUserId,
        userName: myUserName,
        value,
        respondedAt: Date.now(),
      };
      const filtered = state.responses.filter((r: ScaleResponse) => r.userId !== myUserId);
      await updateState({ ...state, responses: [...filtered, newResponse] });
    },
    [state, myUserId, myUserName, updateState],
  );

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <ConsensusScale
      config={config}
      state={state}
      myUserId={myUserId}
      onSelect={handleSelect}
    />
  );
}
