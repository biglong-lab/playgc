// 🔐 LockCoopPage — LockCoop 元件的容器（自取 teamId / members + WebSocket 同步）
//
// 角色：
//   - LockCoop（純 UI）的容器層
//   - 從 gameId 自動找隊伍（GET /api/games/:gameId/my-team）
//   - 用 useTeamLockCoopSync 接 WebSocket 同步輸入 / 嘗試 / 解鎖
//   - 入場提示對講機（useWalkieSuggestion）
//   - 沒組隊 → fallback UI
//
// GamePageRenderer 用此元件對應 pageType="lock_coop"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.5

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useComponentTelemetry } from "@/hooks/useComponentTelemetry";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useTeamLockCoopSync } from "../shared/hooks/useTeamLockCoopSync";
import LockCoop from "./LockCoop";
import type { LockCoopConfig } from "@shared/schema";
import TeamRequiredFallback from "../shared/ui/TeamRequiredFallback";

// 📊 Phase 1 telemetry import
// （hook 自動 fire-and-forget、失敗不影響元件）

export interface LockCoopPageProps {
  config: LockCoopConfig;
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

function deriveDisplayName(m: MyTeamResponse["members"][number]): string {
  const u = m.user;
  if (!u) return m.userId.slice(0, 8);
  const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (u.email) return u.email.split("@")[0];
  return u.id.slice(0, 8);
}

export default function LockCoopPage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: LockCoopPageProps) {
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
  const memberCount = myTeam?.members?.length ?? 0;

  // 📊 Phase 1 telemetry — 紀錄元件健康度（fire-and-forget、不影響邏輯）
  const tele = useComponentTelemetry({
    componentType: "lock_coop",
    sessionId, userId: user?.id, teamId, pageId,
  });

  // 攔截 onComplete → 標記 completed
  const handleComplete = (...args: Parameters<typeof onComplete>) => {
    tele.reportComplete("completed");
    onComplete(...args);
  };

  const myDisplayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ").trim()
      || user.email?.split("@")[0]
      || user.id.slice(0, 8)
    : "我";

  // 隊伍同步狀態（共享輸入 / 嘗試 / 解鎖）— L3 持久化
  const lockState = useTeamLockCoopSync({
    teamId,
    sessionId,
    pageId,
    userId: user?.id,
    userName: myDisplayName,
    config,
    enabled: !!teamId && !!user,
  });

  // 多人元件入場提示對講機（同 session + 同 team 只一次）
  useWalkieSuggestion({ teamId });

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="lock-coop-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="lock-coop-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    // 🛟 2026-07-08 CHITO #ec3f612b：共用 fallback（含「重新連線原隊伍」回歸入口）
    return <TeamRequiredFallback gameId={gameId} testIdPrefix="lock-coop-page" />;
  }

  if (!lockState.isLoaded) {
    return (
      <Card data-testid="lock-coop-page-state-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // 主要渲染（LockCoop）
  // ============================================================================

  return (
    <LockCoop
      config={config}
      myUserId={user.id}
      sessionId={sessionId}
      memberCount={memberCount}
      sharedCode={lockState.sharedCode}
      attempts={lockState.attempts}
      isUnlocked={lockState.isUnlocked}
      isFailed={lockState.isFailed}
      onCodeChange={(...a) => { tele.reportInteraction(); return lockState.onCodeChange(...a); }}
      onAttempt={lockState.onAttempt}
      onComplete={handleComplete}
    />
  );
}

// 顯式引用 deriveDisplayName 避免 lint warning（保留給未來顯示隊員列表用）
export { deriveDisplayName };
