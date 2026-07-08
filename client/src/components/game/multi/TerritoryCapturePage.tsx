// 🚩 TerritoryCapturePage — TerritoryCapture 元件的容器
//
// 角色：
//   - TerritoryCapture（純 UI）的容器層
//   - 自取 teamId（GET /api/games/:gameId/my-team）
//   - 用 useStableGeolocation 取自己位置
//   - 用 useTeamTerritorySync 廣播 / 接 capture 訊息（session 範圍）
//   - 計算倒數（client-side：startedAt + timeLimitSec）
//   - 入場提示對講機
//
// GamePageRenderer 用此元件對應 pageType="territory_capture"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.8

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStableGeolocation } from "@/lib/geolocation";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useTeamTerritorySync } from "../shared/hooks/useTeamTerritorySync";
import TerritoryCapture from "./TerritoryCapture";
import type { TerritoryCaptureConfig } from "@shared/schema";
import TeamRequiredFallback from "../shared/ui/TeamRequiredFallback";

export interface TerritoryCapturePageProps {
  config: TerritoryCaptureConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  pageId: string;
}

interface MyTeamResponse {
  id: string;
  members: Array<{
    userId: string;
    user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string };
  }>;
}

export default function TerritoryCapturePage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: TerritoryCapturePageProps) {
  const { user } = useAuth();

  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
    // 🛡️ 2026-07-08 CHITO #0e0f5f17：10s refetch — 被移出隊伍後 my-team 變 null
    //   → 切到 TeamRequiredFallback（含重新連線入口），不再卡舊快取死轉
    refetchInterval: 10_000,
  });

  const teamId = myTeam?.id;
  const myDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      || user.email?.split("@")[0]
      || user.id.slice(0, 8)
    : "我";

  // 玩家自己 GPS 位置（容器內監聽）
  const { position } = useStableGeolocation({ enabled: !!teamId });
  const myPosition = position
    ? { lat: position.lat, lng: position.lng }
    : null;

  // session 範圍同步（多隊共享）+ L3 DB 持久化
  const { captures, isLoaded: capturesLoaded, onCapture } = useTeamTerritorySync({
    teamId,
    sessionId,
    userId: user?.id,
    userName: myDisplayName,
    pageId,
    enabled: !!teamId && !!user && !!sessionId,
  });

  useWalkieSuggestion({ teamId });

  // 倒數計時（client-side：mount 時 startedAt = Date.now()）
  // server 權威時間留給未來優化（§7 useServerTimer）
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!config.timeLimitSec || config.timeLimitSec <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [config.timeLimitSec]);

  const remainingSec = config.timeLimitSec
    ? Math.max(0, config.timeLimitSec - Math.floor((now - startedAt) / 1000))
    : null;
  const isTimeUp = remainingSec !== null && remainingSec <= 0;

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="territory-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="territory-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    // 🛟 2026-07-08 CHITO #ec3f612b：共用 fallback（含「重新連線原隊伍」回歸入口）
    return <TeamRequiredFallback gameId={gameId} testIdPrefix="territory-page" />;
  }

  if (!capturesLoaded) {
    return (
      <Card data-testid="territory-page-state-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // 主要渲染
  // ============================================================================

  return (
    <TerritoryCapture
      config={config}
      myTeamId={teamId}
      myPosition={myPosition}
      captures={captures}
      remainingSec={remainingSec}
      isTimeUp={isTimeUp}
      onCapture={onCapture}
      onComplete={onComplete}
    />
  );
}
