import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PresenceMap from "./PresenceMap";
import type { PresenceMapConfig, PresenceMapState, PresenceDot } from "./PresenceMap";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface PresenceMapPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: PresenceMapConfig = {
  title: "🗺️ 個性地圖",
  xAxisLeft: "內向",
  xAxisRight: "外向",
  yAxisTop: "理性",
  yAxisBottom: "感性",
  showNames: true,
};

const DEFAULT_STATE: PresenceMapState = {
  dots: [],
};

export default function PresenceMapPage({ page, sessionId, gameId, pageId }: PresenceMapPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: PresenceMapConfig } | PresenceMapConfig | null) ?? null;
  const config: PresenceMapConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as PresenceMapConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<PresenceMapState>({
    gameId,
    sessionId,
    pageId,
    type: "presence_map",
    defaultState: DEFAULT_STATE,
  });

  const [localDot, setLocalDot] = useState<{ x: number; y: number } | null>(null);

  const handleCanvasClick = useCallback(
    (x: number, y: number) => {
      const alreadyConfirmed = state.dots.some((d: PresenceDot) => d.userId === myUserId);
      if (alreadyConfirmed) return;
      setLocalDot({ x, y });
    },
    [state.dots, myUserId]
  );

  const handleConfirm = useCallback(async () => {
    if (!localDot) return;
    const already = state.dots.some((d: PresenceDot) => d.userId === myUserId);
    if (already) return;
    const newDot: PresenceDot = {
      userId: myUserId,
      userName: myUserName,
      x: localDot.x,
      y: localDot.y,
    };
    await updateState({ ...state, dots: [...state.dots, newDot] });
    setLocalDot(null);
  }, [localDot, state, myUserId, myUserName, updateState]);

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
    <PresenceMap
      config={config}
      state={state}
      myUserId={myUserId}
      localDot={localDot}
      onCanvasClick={handleCanvasClick}
      onConfirm={handleConfirm}
    />
  );
}
