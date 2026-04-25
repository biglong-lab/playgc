// 推廣邀請接受頁 — Phase 12.1
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13.4
//
// URL: /invite/squad/:token
//
// 流程：
//   1. 載入 → 顯示隊伍資訊 + click 紀錄
//   2. 未登入 → 引導登入（保留 token 在 URL）
//   3. 已登入 → 一鍵加入隊伍
//
import { useEffect, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  Crown,
  Users,
  Trophy,
  Loader2,
  AlertCircle,
} from "lucide-react";

interface InviteInfo {
  squadId: string;
  squadName: string;
  squadTag: string | null;
  totalGames: number;
  recruitsCount: number;
  superLeaderTier: string | null;
  valid: boolean;
}

export default function SquadInvite() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [, setLocation] = useLocation();
  const { user, isSignedIn, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [hasClicked, setHasClicked] = useState(false);

  // 載入邀請資訊
  const { data: invite, isLoading, error } = useQuery<InviteInfo>({
    queryKey: ["/api/invites", token],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/invites/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "邀請不存在");
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  // 一進頁面就紀錄一次點擊（去重靠 sessionStorage）
  useEffect(() => {
    if (!token || hasClicked) return;
    const key = `invite_click_${token}`;
    if (sessionStorage.getItem(key)) {
      setHasClicked(true);
      return;
    }
    sessionStorage.setItem(key, "1");
    apiRequest("POST", `/api/invites/${token}/click`, {})
      .catch(() => {})
      .finally(() => setHasClicked(true));
  }, [token, hasClicked]);

  // 接受邀請
  const acceptMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/invites/${token}/accept`, {});
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "接受邀請失敗");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "🎉 已加入隊伍！",
        description: data.rewards?.isSuperLeader
          ? `獲得 ${data.rewards.expBonus} 體驗點數（超級隊長 ×2）`
          : `獲得 ${data.rewards?.expBonus ?? 50} 體驗點數`,
      });
      qc.invalidateQueries({ queryKey: ["/api/me/memberships"] });
      // 導向隊伍主頁
      setTimeout(() => setLocation(`/squad/${data.squadId}`), 1500);
    },
    onError: (err: Error) => {
      toast({
        title: "加入失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  if (isLoading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
            <h2 className="text-lg font-bold mb-2">邀請失效</h2>
            <p className="text-sm text-muted-foreground mb-4">
              {error instanceof Error ? error.message : "邀請連結不存在或已失效"}
            </p>
            <Link href="/">
              <Button>返回首頁</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSuperLeader = ["gold", "platinum", "super"].includes(
    invite.superLeaderTier ?? "",
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-amber-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-2xl">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎉</div>
            <h1 className="text-2xl font-bold mb-1">你被邀請加入隊伍！</h1>
            <p className="text-sm text-muted-foreground">
              加入後可累積跨遊戲戰績和體驗點數
            </p>
          </div>

          {/* 隊伍資訊卡片 */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-2xl">
                {isSuperLeader ? "🌟" : "🛡️"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="font-bold text-lg truncate">
                    {invite.squadName}
                  </h2>
                  {isSuperLeader && (
                    <Badge className="bg-amber-500 text-white text-[10px]">
                      <Crown className="w-3 h-3 mr-0.5" />
                      超級隊長
                    </Badge>
                  )}
                </div>
                {invite.squadTag && (
                  <p className="text-xs text-muted-foreground font-mono">
                    [{invite.squadTag}]
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/80 dark:bg-black/30 rounded p-2">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Trophy className="w-3 h-3" />
                  總場次
                </div>
                <div className="font-bold text-lg text-emerald-700">
                  {invite.totalGames}
                </div>
              </div>
              <div className="bg-white/80 dark:bg-black/30 rounded p-2">
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mb-0.5">
                  <Users className="w-3 h-3" />
                  招募成員
                </div>
                <div className="font-bold text-lg text-emerald-700">
                  {invite.recruitsCount}
                </div>
              </div>
            </div>
          </div>

          {/* 雙向獎勵說明 */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-6">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  雙向招募獎勵
                </p>
                <p className="text-xs text-amber-800 dark:text-amber-200 mt-0.5">
                  你和邀請人都能獲得 {isSuperLeader ? "100" : "50"} 體驗點數
                  {isSuperLeader && "（超級隊長 ×2）"}
                </p>
              </div>
            </div>
          </div>

          {/* 動作按鈕 */}
          {!isSignedIn || !user ? (
            <div className="space-y-2">
              <p className="text-sm text-center text-muted-foreground mb-2">
                請先登入再接受邀請
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  // 把 token 存 sessionStorage，登入後自動接受
                  sessionStorage.setItem("pending_invite_token", token);
                  setLocation("/");
                }}
              >
                前往登入
              </Button>
            </div>
          ) : (
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700"
              size="lg"
              onClick={() => acceptMut.mutate()}
              disabled={acceptMut.isPending}
            >
              {acceptMut.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  加入中...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  接受邀請並加入
                </>
              )}
            </Button>
          )}

          <p className="text-[10px] text-muted-foreground text-center mt-3">
            加入後可選擇隨時退出
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
