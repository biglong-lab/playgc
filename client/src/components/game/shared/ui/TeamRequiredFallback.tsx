// 🛟 TeamRequiredFallback — 多人元件「找不到隊伍」時的統一 fallback
//
// 背景（CHITO #ec3f612b 2026-07-08）：
//   玩家退出 / 被 auto-leave 後重進遊戲 → my-team 回 null → 各多人元件
//   只顯示「此元件需要組隊使用」死路，玩家不知道能否回原隊伍。
//   此元件補上回歸路徑：查 rejoinable-team → 顯示「重新連線原隊伍」，
//   rejoin 成功後 invalidate my-team → 父層元件自動 re-render 進入正常流程。
//
// 用法：取代各 XxxPage 的 no-team fallback JSX（VoteTeamPage 等 7 處）。

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, RefreshCw } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export interface TeamRequiredFallbackProps {
  gameId: string;
  /** data-testid 前綴（沿用各元件既有 testid 命名，如 "vote-team-page"） */
  testIdPrefix?: string;
}

export default function TeamRequiredFallback({
  gameId,
  testIdPrefix = "team-required",
}: TeamRequiredFallbackProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 查可重新加入的原隊伍（退出 / 被誤踢後的回歸入口）
  const { data: rejoinable } = useQuery<{
    teamId: string;
    name: string;
    status: string;
    memberCount: number;
  } | null>({
    queryKey: ["/api/games", gameId, "rejoinable-team"],
    enabled: !!gameId,
  });

  const rejoinMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const response = await apiRequest("POST", `/api/teams/${teamId}/rejoin`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "已重新加入隊伍", description: "正在恢復隊伍狀態..." });
      // my-team 更新 → 使用此 fallback 的父層元件會自動切回正常流程
      queryClient.invalidateQueries({ queryKey: [`/api/games/${gameId}/my-team`] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "my-team"] });
      queryClient.invalidateQueries({ queryKey: ["/api/games", gameId, "rejoinable-team"] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : "無法重新加入";
      toast({ title: "重新加入失敗", description: msg, variant: "destructive" });
    },
  });

  return (
    <Card data-testid={`${testIdPrefix}-no-team`}>
      <CardContent className="p-6 text-center">
        <Users className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm font-medium mb-1">此元件需要組隊使用</p>
        {rejoinable ? (
          <div className="space-y-3 mt-3">
            <p className="text-xs text-muted-foreground">
              偵測到你之前的隊伍「{rejoinable.name}」仍在進行中
            </p>
            <Button
              size="sm"
              onClick={() => rejoinMutation.mutate(rejoinable.teamId)}
              disabled={rejoinMutation.isPending}
              data-testid={`${testIdPrefix}-rejoin-button`}
            >
              <RefreshCw
                className={`w-4 h-4 mr-1 ${rejoinMutation.isPending ? "animate-spin" : ""}`}
              />
              {rejoinMutation.isPending ? "重新連線中..." : "重新連線原隊伍"}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            請回到場域首頁建立或加入隊伍
          </p>
        )}
      </CardContent>
    </Card>
  );
}
