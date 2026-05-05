// 🗺 GpsCascadePage — pageType="gps_cascade" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GpsCascade, { type GpsCascadeConfig } from "./GpsCascade";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface GpsCascadePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface GpsCascadeState extends Record<string, unknown> {
  reachedPointIds: string[];
}

export default function GpsCascadePage({ page, sessionId, gameId, pageId }: GpsCascadePageProps) {
  const rawConfig = (page.config as { config?: GpsCascadeConfig } | GpsCascadeConfig | null) ?? null;
  const config: GpsCascadeConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GpsCascadeConfig | null)) ?? {
      title: "🗺 金門古蹟巡禮",
      subtitle: "依序探訪、解鎖故事",
      points: [
        { id: "p1", name: "後浦老街", hint: "找到入口的牌樓，看到「後浦」兩個字", story: "後浦老街是金門最早的商業聚落。" },
        { id: "p2", name: "賈村牌坊", hint: "從後浦老街往南走 200m", story: "賈村牌坊是清代節孝坊。" },
        { id: "p3", name: "莒光樓", hint: "金門最具代表性的建築", story: "莒光樓於 1953 年建成，現為金門地標。" },
      ],
    };

  const defaultState: GpsCascadeState = { reachedPointIds: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<GpsCascadeState>({
    gameId, sessionId, pageId, type: "gps_cascade", defaultState,
  });

  const handleReach = useCallback(async (pointId: string) => {
    if (state.reachedPointIds.includes(pointId)) return;
    await updateState({ reachedPointIds: [...state.reachedPointIds, pointId] });
  }, [state.reachedPointIds, updateState]);

  if (!isLoaded) {
    return (
      <Card data-testid="gps-cascade-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return <GpsCascade config={config} state={state} onReachPoint={handleReach} />;
}
