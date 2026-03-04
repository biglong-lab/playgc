// 水彈對戰 PK 擂台 — 戰隊詳情頁
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { BattleClan, BattleClanMember } from "@shared/schema";
import { clanRoleLabels, type ClanRole } from "@shared/schema";
import { ArrowLeft, Shield, Users, Trophy, Crown, Star } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ClanDetailResponse extends BattleClan {
  members: BattleClanMember[];
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
      const res = await fetch(`/api/battle/clans/${clanId}`);
      if (!res.ok) throw new Error("取得戰隊失敗");
      return res.json();
    },
    enabled: !!clanId,
  });

  const joinMutation = useMutation({
    mutationFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch(`/api/battle/clans/${clanId}/join?fieldId=${user?.defaultFieldId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
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
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch(`/api/battle/clans/${clanId}/leave`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!clan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">戰隊不存在</p>
        <Link href="/battle">
          <Button variant="outline">返回</Button>
        </Link>
      </div>
    );
  }

  const isMember = clan.members.some((m) => m.userId === user?.id && !m.leftAt);
  const isLeader = clan.leaderId === user?.id;
  const winRate = (clan.totalWins + clan.totalLosses + clan.totalDraws) > 0
    ? Math.round((clan.totalWins / (clan.totalWins + clan.totalLosses + clan.totalDraws)) * 100)
    : 0;

  const roleIcon = (role: string) => {
    if (role === "leader") return <Crown className="h-3 w-3 text-yellow-500" />;
    if (role === "officer") return <Star className="h-3 w-3 text-blue-500" />;
    return null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <Link href="/battle">
            <Button variant="ghost" size="sm" className="text-white/70 hover:text-white gap-1 mb-2">
              <ArrowLeft className="h-4 w-4" /> 返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8" />
            <div>
              <h1 className="text-2xl font-bold">
                [{clan.tag}] {clan.name}
              </h1>
              {clan.description && (
                <p className="text-white/80 text-sm mt-1">{clan.description}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* 戰隊數據 */}
        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{clan.clanRating}</p>
              <p className="text-xs text-muted-foreground">積分</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{clan.totalWins}</p>
              <p className="text-xs text-muted-foreground">勝</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{clan.totalLosses}</p>
              <p className="text-xs text-muted-foreground">負</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold">{winRate}%</p>
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
            className="w-full text-red-600"
            onClick={() => leaveMutation.mutate()}
            disabled={leaveMutation.isPending}
          >
            離開戰隊
          </Button>
        )}

        {/* 成員列表 */}
        <Card>
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
                      {member.userId.slice(0, 10)}...
                      {member.userId === user?.id && <span className="text-blue-600">(你)</span>}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {clanRoleLabels[member.role as ClanRole] ?? member.role}
                    </Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
