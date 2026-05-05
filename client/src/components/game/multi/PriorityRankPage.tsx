import { useCallback, useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PriorityRank, {
  type PriorityRankConfig,
  type PriorityRankState,
  type UserRanking,
} from "./PriorityRank";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PriorityRankPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PriorityRankConfig = {
  title: "🏆 優先順序排名",
  question: "請依重要程度排列以下項目（1 = 最重要）",
  items: [
    { id: "a", label: "項目 A", emoji: "🔵" },
    { id: "b", label: "項目 B", emoji: "🟢" },
    { id: "c", label: "項目 C", emoji: "🟡" },
    { id: "d", label: "項目 D", emoji: "🔴" },
  ],
  showConsensus: true,
};

const DEFAULT_STATE: PriorityRankState = { rankings: [] };

export default function PriorityRankPage({ page, sessionId, gameId, pageId }: PriorityRankPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PriorityRankConfig } | PriorityRankConfig | null) ?? null;
  const config: PriorityRankConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PriorityRankConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PriorityRankState>({
    gameId,
    sessionId,
    pageId,
    type: "priority_rank",
    defaultState: DEFAULT_STATE,
  });

  const [localRanks, setLocalRanks] = useState<string[]>(() => config.items.map((item) => item.id));

  useEffect(() => {
    setLocalRanks(config.items.map((item) => item.id));
  }, [config.items.length]);

  const handleMoveUp = useCallback((index: number) => {
    if (index === 0) return;
    setLocalRanks((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
  }, []);

  const handleMoveDown = useCallback((index: number) => {
    setLocalRanks((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.rankings.some((r: UserRanking) => r.userId === myUserId)) return;
    const newRanking: UserRanking = {
      userId: myUserId,
      userName: myUserName,
      ranks: localRanks,
      submittedAt: Date.now(),
    };
    await updateState({ ...state, rankings: [...state.rankings, newRanking] });
  }, [state, myUserId, myUserName, localRanks, updateState]);

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
    <PriorityRank
      config={config}
      state={state}
      myUserId={myUserId}
      localRanks={localRanks}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onSubmit={handleSubmit}
    />
  );
}
