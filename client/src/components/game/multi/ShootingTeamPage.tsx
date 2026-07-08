// 🎯 ShootingTeamPage — ShootingTeam 元件的容器（自取 teamId / members + WebSocket）
//
// 角色：
//   - ShootingTeam（純 UI）的容器層
//   - 從 gameId 自動找隊伍（GET /api/games/:gameId/my-team）
//   - 用 useTeamShootingSync 訂閱 WebSocket 累積全隊 hits
//   - 沒組隊 → fallback UI
//
// GamePageRenderer 用此元件對應 pageType="shooting_team"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.3

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useTeamShootingSync } from "../shared/hooks/useTeamShootingSync";
import ShootingTeam, { type TeamMemberInfo } from "./ShootingTeam";
import type { ShootingMissionConfig } from "@shared/schema";
import TeamRequiredFallback from "../shared/ui/TeamRequiredFallback";
import { useMyTeam } from "../shared/hooks/useMyTeam";

export interface ShootingTeamPageProps {
  config: ShootingMissionConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  pageId?: string;
}

interface MyTeamResponse {
  id: string;
  members: Array<{
    userId: string;
    user?: { id: string; firstName?: string | null; lastName?: string | null; email?: string | null};
  }>;
}

/** 從 user 物件取出顯示名（優先 firstName + lastName，再 email，最後 userId） */
function deriveDisplayName(user: MyTeamResponse["members"][number]): string {
  const u = user.user;
  if (!u) return user.userId.slice(0, 8);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (u.email) return u.email.split("@")[0];
  return u.id.slice(0, 8);
}

export default function ShootingTeamPage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: ShootingTeamPageProps) {
  const { user } = useAuth();

  // 取隊伍資訊
  // 👥 2026-07-09 C2（全站優化盤點）：my-team 查詢統一到 useMyTeam hook
  //   （原 7 個容器各自複製同段 useQuery，複製漂移曾造成同步 bug）
  const { myTeam, teamLoading, teamError } = useMyTeam(gameId, !!user);

  const myDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.email?.split("@")[0] ||
      user.id.slice(0, 8)
    : "我";

  const teamId = myTeam?.id;
  const enabled = !!teamId && !!user;

  // 訂閱 WebSocket 累積全隊 hits + L3 DB 持久化
  const { teamHits, isLoaded: hitsLoaded } = useTeamShootingSync({
    sessionId,
    myUserId: user?.id ?? "",
    myDisplayName,
    teamId,
    pageId,
    enabled,
  });

  // 🆕 多人元件入場時提示玩家「建議開啟對講機」（同 session + 同 team 只一次）
  useWalkieSuggestion({ teamId });

  // 將 myTeam.members 轉成 TeamMemberInfo
  const members: TeamMemberInfo[] = (myTeam?.members ?? []).map((m) => ({
    userId: m.userId,
    displayName: deriveDisplayName(m),
  }));

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="shooting-team-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="shooting-team-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    // 🛟 2026-07-08 CHITO #ec3f612b：共用 fallback（含「重新連線原隊伍」回歸入口）
    return <TeamRequiredFallback gameId={gameId} testIdPrefix="shooting-team-page" />;
  }

  if (!hitsLoaded) {
    return (
      <Card data-testid="shooting-team-page-state-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <ShootingTeam
      config={config}
      myUserId={user.id}
      teamHits={teamHits}
      members={members}
      onComplete={onComplete}
    />
  );
}
