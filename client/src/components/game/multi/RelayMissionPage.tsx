// 🏃 RelayMissionPage — RelayMission 元件的容器（自取 teamId / members + WebSocket 同步）
//
// 角色：
//   - RelayMission（純 UI）的容器層
//   - 從 gameId 自動找隊伍（GET /api/games/:gameId/my-team）
//   - 用 useTeamRelaySync 接 WebSocket 同步段間切換
//   - 入場提示對講機（useWalkieSuggestion）
//   - 沒組隊 → fallback UI
//
// GamePageRenderer 用此元件對應 pageType="relay_mission"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.7

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useTeamRelaySync } from "../shared/hooks/useTeamRelaySync";
import RelayMission from "./RelayMission";
import type { RelayMissionConfig } from "@shared/schema";
import TeamRequiredFallback from "../shared/ui/TeamRequiredFallback";

export interface RelayMissionPageProps {
  config: RelayMissionConfig;
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

export default function RelayMissionPage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: RelayMissionPageProps) {
  const { user } = useAuth();

  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
  });

  const teamId = myTeam?.id;
  const memberUserIds = useMemo(
    () => (myTeam?.members ?? []).map((m) => m.userId),
    [myTeam?.members],
  );

  const myDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      || user.email?.split("@")[0]
      || user.id.slice(0, 8)
    : "我";

  const relayState = useTeamRelaySync({
    teamId,
    sessionId,
    pageId,
    userId: user?.id,
    userName: myDisplayName,
    config,
    enabled: !!teamId && !!user,
  });

  useWalkieSuggestion({ teamId });

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="relay-mission-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="relay-mission-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    // 🛟 2026-07-08 CHITO #ec3f612b：共用 fallback（含「重新連線原隊伍」回歸入口）
    return <TeamRequiredFallback gameId={gameId} testIdPrefix="relay-mission-page" />;
  }

  if (!relayState.isLoaded) {
    return (
      <Card data-testid="relay-mission-page-state-loading">
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
    <RelayMission
      config={config}
      myUserId={user.id}
      sessionId={sessionId}
      memberUserIds={memberUserIds}
      currentSegmentIndex={relayState.currentSegmentIndex}
      completedSegments={relayState.completedSegments}
      isAllComplete={relayState.isAllComplete}
      onSubmitAnswer={relayState.onSubmitAnswer}
      onComplete={onComplete}
    />
  );
}
