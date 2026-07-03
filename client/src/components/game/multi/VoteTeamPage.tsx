// 🗳️ VoteTeamPage — 隊伍投票元件的容器（自取 teamId / members）
//
// 角色：
//   - VoteTeam（純 UI presentation）的容器層
//   - 從 gameId 自動找當前玩家的 team（GET /api/games/:gameId/my-team）
//   - 用 useTeamVoteSync 接後端 + WebSocket
//   - 沒組隊 → 顯示提示訊息
//
// GamePageRenderer 用此元件對應 pageType="vote_team"
//
// 設計依據：docs/GAME_COMPONENT_MULTIPLAYER_PLAN.md §6.2 + VOTE_SYNC_PLAN.md

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Users, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useComponentTelemetry } from "@/hooks/useComponentTelemetry";
import { useTeamWebSocket } from "@/hooks/use-team-websocket";
import { useWalkieSuggestion } from "@/hooks/useWalkieSuggestion";
import { useTeamVoteSync } from "../shared/hooks/useTeamVoteSync";
import VoteTeam from "./VoteTeam";
import type { VoteConfig } from "@shared/schema";

/** 此元件需要的 props（GamePageRenderer 透過 commonProps + pageId 傳入） */
export interface VoteTeamPageProps {
  config: VoteConfig;
  onComplete: (
    reward?: { points?: number; items?: string[] },
    nextPageId?: string,
  ) => void;
  sessionId: string;
  gameId: string;
  /** 當前 page id（用來建立投票歸屬） */
  pageId: string;
}

/** GET /api/games/:gameId/my-team 回傳結構（簡化版，只取我們需要的） */
interface MyTeamResponse {
  id: string;
  members: Array<{ userId: string; user?: { id: string } }>;
}

export default function VoteTeamPage({
  config,
  onComplete,
  sessionId,
  gameId,
  pageId,
}: VoteTeamPageProps) {
  const { user } = useAuth();

  // 取得當前玩家的隊伍
  const {
    data: myTeam,
    isLoading: teamLoading,
    isError: teamError,
  } = useQuery<MyTeamResponse | null>({
    queryKey: [`/api/games/${gameId}/my-team`],
    enabled: !!gameId && !!user,
    // 🛡️ 2026-07-04 多人穩定性 Phase A2：投票分母（totalMembers）需跟上成員變動
    //   （原本不 refetch → 投票中有人加入/離開時各裝置分母不同 → 完成判定不同步）
    refetchInterval: 10_000,
  });

  // 整合 hook（teamId 還沒有時 enabled=false 不發 request）
  const teamId = myTeam?.id;
  const totalMembers = myTeam?.members?.length ?? 0;

  // 📊 Phase 1 telemetry
  const tele = useComponentTelemetry({
    componentType: "vote_team",
    sessionId, userId: user?.id, teamId, pageId,
  });
  const handleComplete = (...args: Parameters<typeof onComplete>) => {
    tele.reportComplete("completed");
    onComplete(...args);
  };

  const { voteState, ensureVote, castVote, handleWsMessage, refetchNow } = useTeamVoteSync({
    teamId: teamId ?? "",
    pageId,
    config,
    votingMode: "majority", // 預設過半，admin 後續可在 config 加開關
    totalMembers,
    enabled: !!teamId && !!pageId,
  });

  // 推導顯示名（給 useTeamWebSocket 用）
  const myDisplayName = useMemo(() => {
    if (!user) return "我";
    const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    if (fullName) return fullName;
    if (user.email) return user.email.split("@")[0];
    return user.id.slice(0, 8);
  }, [user]);

  // 訊息 adapter — 把 useTeamWebSocket 的通用訊息轉發給 useTeamVoteSync
  // 注意：TeamMessage 型別未列 `vote` 欄位（vote_created 有），用 unknown cast 廣義處理
  const handleVoteWsMessage = useCallback(
    (msg: { type: string; voteId?: string; userId?: string; choice?: string }) => {
      if (msg.type === "vote_cast" || msg.type === "vote_created") {
        handleWsMessage(
          msg as unknown as Parameters<typeof handleWsMessage>[0],
        );
      }
    },
    [handleWsMessage],
  );

  // 連 WebSocket（接 vote_cast / vote_created 訊息）
  useTeamWebSocket({
    teamId,
    userId: user?.id,
    userName: myDisplayName,
    onMessage: handleVoteWsMessage,
  });

  // 🆕 多人元件入場時提示玩家「建議開啟對講機」（同 session + 同 team 只一次）
  useWalkieSuggestion({ teamId });

  // ============================================================================
  // Fallback UI
  // ============================================================================

  if (!user) {
    return (
      <Card data-testid="vote-team-page-not-authed">
        <CardContent className="p-6 text-center">
          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">請先登入後再使用</p>
        </CardContent>
      </Card>
    );
  }

  if (teamLoading) {
    return (
      <Card data-testid="vote-team-page-loading">
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          載入隊伍資訊中...
        </CardContent>
      </Card>
    );
  }

  if (teamError || !myTeam || !teamId) {
    return (
      <Card data-testid="vote-team-page-no-team">
        <CardContent className="p-6 text-center">
          <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">此元件需要組隊使用</p>
          <p className="text-xs text-muted-foreground">
            請回到場域首頁建立或加入隊伍
          </p>
        </CardContent>
      </Card>
    );
  }

  // ============================================================================
  // 主要渲染（VoteTeam）
  // ============================================================================

  return (
    <VoteTeam
      config={config}
      myUserId={user.id}
      teamId={teamId}
      voteState={voteState}
      onEnsureVote={ensureVote}
      onCastVote={(...a) => { tele.reportInteraction(); return castVote(...a); }}
      onComplete={handleComplete}
    />
  );
}
