import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TeamHealthCheck, {
  type TeamHealthConfig,
  type TeamHealthState,
  type TeamHealthResponse,
} from "./TeamHealthCheck";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TeamHealthCheckPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: TeamHealthConfig = {
  title: "💪 團隊健康評估",
  dimensions: [
    { id: "safety", label: "心理安全感", emoji: "🛡️", description: "可以自由表達意見" },
    { id: "comm", label: "溝通透明度", emoji: "💬", description: "資訊流通順暢" },
    { id: "trust", label: "互相信任", emoji: "🤝", description: "信任彼此的專業" },
    { id: "energy", label: "團隊能量", emoji: "⚡", description: "充滿活力與動力" },
  ],
  scaleMin: 1,
  scaleMax: 5,
  anonymous: true,
  showResults: true,
};

const DEFAULT_STATE: TeamHealthState = { responses: [] };

export default function TeamHealthCheckPage({ page, sessionId, gameId, pageId }: TeamHealthCheckPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: TeamHealthConfig } | TeamHealthConfig | null) ?? null;
  const config: TeamHealthConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TeamHealthConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamHealthState>({
    gameId,
    sessionId,
    pageId,
    type: "team_health_check",
    defaultState: DEFAULT_STATE,
  });

  const [localScores, setLocalScores] = useState<Record<string, number>>({});

  const handleScoreChange = useCallback((dimensionId: string, score: number) => {
    setLocalScores((prev) => ({ ...prev, [dimensionId]: score }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.responses.some((r: TeamHealthResponse) => r.userId === myUserId)) return;
    const newResponse: TeamHealthResponse = {
      userId: myUserId,
      userName: config.anonymous ? "匿名" : myUserName,
      scores: localScores,
      submittedAt: Date.now(),
    };
    await updateState({ ...state, responses: [...state.responses, newResponse] });
  }, [state, myUserId, myUserName, localScores, config.anonymous, updateState]);

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
    <TeamHealthCheck
      config={config}
      state={state}
      myUserId={myUserId}
      localScores={localScores}
      onScoreChange={handleScoreChange}
      onSubmit={handleSubmit}
    />
  );
}
