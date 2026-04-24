// 水彈對戰 PK 擂台 — 戰隊詳情頁（深色軍事風格）
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattleClan } from "@shared/schema";
import { clanRoleLabels, type ClanRole } from "@shared/schema";
import { Shield, Users, Trophy, Crown, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authFetch } from "@/lib/authFetch";
import { apiRequest } from "@/lib/queryClient";
import ClanManagePanel, { MemberActionMenu, type ClanMemberWithName } from "@/components/battle/ClanManagePanel";

interface ClanDetailResponse extends BattleClan {
  members: ClanMemberWithName[];
  myRole?: string;
}

export default function BattleClanDetail() {
  const [, params] = useRoute("/battle/clan/:clanId");
  const clanId = params?.clanId ?? "";
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: clan, isLoading } = useQuery<ClanDetailResponse>({
    queryKey: ["/api/battle/clans", clanId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/battle/clans/${clanId}`);
      return res.json();
    },
    enabled: !!clanId,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const joinFieldId = user?.defaultFieldId || clan?.fieldId || "";
      const res = await authFetch(`/api/battle/clans/${clanId}/join?fieldId=${joinFieldId}`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "加入失敗");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "已加入戰隊" });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my/clan"] });
    },
    onError: (err: Error) => {
      toast({ title: "加入失敗", description: err.message, variant: "destructive" });
    },
  });

  const leaveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/battle/clans/${clanId}/leave`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "離開失敗");
      }
    },
    onSuccess: () => {
      toast({ title: "已離開戰隊" });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/clans"] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my/clan"] });
    },
    onError: (err: Error) => {
      toast({ title: "離開失敗", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">戰隊不存在</p>
        <Link href="/battle">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    );
  }

  const isMember = clan.members.some((m) => m.userId === user?.id && !m.leftAt);
  const isLeader = clan.leaderId === user?.id;
  const myMembership = clan.members.find((m) => m.userId === user?.id && !m.leftAt);
  const myRole = clan.myRole ?? myMembership?.role ?? "member";
  const winRate = (clan.totalWins + clan.totalLosses + clan.totalDraws) > 0
    ? Math.round((clan.totalWins / (clan.totalWins + clan.totalLosses + clan.totalDraws)) * 100)
    : 0;

  const roleIcon = (role: string) => {
    if (role === "leader") return <Crown className="h-3 w-3 text-yellow-500" />;
    if (role === "officer") return <Star className="h-3 w-3 text-blue-400" />;
    return null;
  };

  return (
    <BattleLayout title={`[${clan.tag}] ${clan.name}`} subtitle={clan.description || undefined}>
      <div className="space-y-4">
        {/* 戰隊數據 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-number font-bold">{clan.clanRating}</p>
              <p className="text-xs text-muted-foreground">積分</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-number font-bold text-green-500">{clan.totalWins}</p>
              <p className="text-xs text-muted-foreground">勝</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-number font-bold text-red-500">{clan.totalLosses}</p>
              <p className="text-xs text-muted-foreground">負</p>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-number font-bold">{winRate}%</p>
              <p className="text-xs text-muted-foreground">勝率</p>
            </CardContent>
          </Card>
        </div>

        {/* 加入/離開按鈕 */}
        {user && !isMember && (
          <Button
            className="w-full"
            onClick={() => joinMutation.mutate()}
            disabled={joinMutation.isPending || clan.memberCount >= clan.maxMembers}
          >
            {clan.memberCount >= clan.maxMembers ? "戰隊已滿" : "加入戰隊"}
          </Button>
        )}
        {isMember && !isLeader && (
          <Button
            variant="outline"
            className="w-full text-destructive"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            離開戰隊
          </Button>
        )}

        {/* 管理面板 */}
        {user && isMember && (myRole === "leader" || myRole === "officer") && (
          <ClanManagePanel clan={clan} members={clan.members} myRole={myRole} myUserId={user.id} />
        )}

        {/* 成員列表 */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              成員 ({clan.members.filter((m) => !m.leftAt).length}/{clan.maxMembers})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {clan.members
                .filter((m) => !m.leftAt)
                .sort((a, b) => {
                  const order = { leader: 0, officer: 1, member: 2 };
                  return (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2);
                })
                .map((member) => (
                  <div key={member.id} className="flex items-center justify-between py-1.5">
                    <span className="flex items-center gap-2 text-sm">
                      {roleIcon(member.role)}
                      {member.displayName ?? member.userId.slice(0, 10)}
                      {member.userId === user?.id && <span className="text-primary">(你)</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      <Badge variant="outline" className="text-xs">
                        {clanRoleLabels[member.role as ClanRole] ?? member.role}
                      </Badge>
                      {user && isMember && (myRole === "leader" || myRole === "officer") && (
                        <MemberActionMenu clan={clan} member={member} myRole={myRole} myUserId={user.id} />
                      )}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </BattleLayout>
  );
}
