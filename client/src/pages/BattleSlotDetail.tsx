// 水彈對戰 PK 擂台 — 時段詳情頁（報名/取消/建立小隊/加入小隊）
import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattleSlot, BattleVenue, BattleRegistration, BattlePremadeGroup } from "@shared/schema";
import {
  Swords, Clock, Users, CalendarDays, UserPlus,
  UserMinus, Shield, Copy, Check, CheckCircle,
} from "lucide-react";

interface RegistrationWithName extends BattleRegistration {
  displayName?: string;
}

interface SlotDetailResponse extends BattleSlot {
  registrations: RegistrationWithName[];
  premadeGroups: BattlePremadeGroup[];
}

export default function BattleSlotDetail() {
  const [, params] = useRoute("/battle/slot/:slotId");
  const slotId = params?.slotId ?? "";
  const { user } = useAuth();
  const { toast } = useToast();

  const [showRegisterDialog, setShowRegisterDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [showJoinTeamDialog, setShowJoinTeamDialog] = useState(false);
  const [skillLevel, setSkillLevel] = useState("beginner");
  const [notes, setNotes] = useState("");
  const [teamName, setTeamName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: slotData, isLoading } = useQuery<SlotDetailResponse>({
    queryKey: ["/api/battle/slots", slotId],
    queryFn: async () => {
      const res = await fetch(`/api/battle/slots/${slotId}`);
      if (!res.ok) throw new Error("取得時段失敗");
      return res.json();
    },
    enabled: !!slotId,
  });

  const { data: venue } = useQuery<BattleVenue>({
    queryKey: ["/api/battle/venues", slotData?.venueId],
    queryFn: async () => {
      const res = await fetch(`/api/battle/venues/${slotData!.venueId}`);
      if (!res.ok) throw new Error("取得場地失敗");
      return res.json();
    },
    enabled: !!slotData?.venueId,
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/battle/slots/${slotId}/register`, {
        skillLevel,
        notes: notes || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my-registrations"] });
      toast({ title: "報名成功！" });
      setShowRegisterDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "報名失敗", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/battle/slots/${slotId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my-registrations"] });
      toast({ title: "已取消報名" });
    },
    onError: (err: Error) => {
      toast({ title: "取消失敗", description: err.message, variant: "destructive" });
    },
  });

  const createTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/battle/slots/${slotId}/premade`, {
        name: teamName || undefined,
      });
      return res.json() as Promise<BattlePremadeGroup>;
    },
    onSuccess: (group) => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
      setAccessCode(group.accessCode);
      setShowCreateTeamDialog(false);
      toast({ title: `小隊已建立！邀請碼：${group.accessCode}` });
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  const joinTeamMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/battle/premade/join", {
        accessCode: accessCode.toUpperCase(),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
      queryClient.invalidateQueries({ queryKey: ["/api/battle/my-registrations"] });
      toast({ title: "成功加入小隊！" });
      setShowJoinTeamDialog(false);
      setAccessCode("");
    },
    onError: (err: Error) => {
      toast({ title: "加入失敗", description: err.message, variant: "destructive" });
    },
  });

  if (isLoading || !slotData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const maxPlayers = slotData.maxPlayersOverride ?? venue?.maxPlayers ?? 20;
  const minPlayers = slotData.minPlayersOverride ?? venue?.minPlayers ?? 8;
  const myRegistration = slotData.registrations?.find(
    (r) => r.userId === user?.id && r.status !== "cancelled",
  );
  const isRegistered = !!myRegistration;
  const canRegister = (slotData.status === "open" || slotData.status === "confirmed") && !isRegistered;
  const myGroup = slotData.premadeGroups?.find((g) => g.leaderId === user?.id);

  return (
    <BattleLayout title={venue?.name ?? "對戰場地"} subtitle="時段詳情">
      <div className="space-y-4">
        {/* 時段資訊 */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Swords className="h-5 w-5 text-primary" />
                {venue?.name ?? "對戰場地"}
              </span>
              <StatusBadge status={slotData.status} />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span>{slotData.slotDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{slotData.startTime?.slice(0, 5)} - {slotData.endTime?.slice(0, 5)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-number">{slotData.currentCount} / {maxPlayers} 人</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span>最低 {minPlayers} 人成局</span>
              </div>
            </div>

            {/* 進度條 */}
            <div className="space-y-1">
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min((slotData.currentCount / maxPlayers) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">
                {slotData.currentCount >= minPlayers ? "已達成局人數" : `還需 ${minPlayers - slotData.currentCount} 人成局`}
              </p>
            </div>

            {slotData.notes && (
              <p className="text-sm text-muted-foreground bg-primary/5 rounded p-2">{slotData.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* 操作按鈕 */}
        <div className="flex gap-2">
          {canRegister && (
            <Button className="flex-1 gap-1" onClick={() => setShowRegisterDialog(true)}>
              <UserPlus className="h-4 w-4" /> 我要報名
            </Button>
          )}
          {isRegistered && myRegistration.status !== "checked_in" && (
            <Button
              variant="destructive"
              className="flex-1 gap-1"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
            >
              <UserMinus className="h-4 w-4" /> 取消報名
            </Button>
          )}
          {isRegistered && !myGroup && (
            <Button variant="outline" className="gap-1" onClick={() => setShowCreateTeamDialog(true)}>
              建立小隊
            </Button>
          )}
          {!isRegistered && (
            <Button variant="outline" className="gap-1" onClick={() => setShowJoinTeamDialog(true)}>
              用邀請碼加入
            </Button>
          )}
        </div>

        {/* 邀請碼顯示 */}
        {myGroup && (
          <Card className="border-green-500/30 bg-green-500/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">我的小隊：{myGroup.name ?? "未命名"}</p>
                  <p className="text-xs text-muted-foreground">成員：{myGroup.memberCount} 人</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    navigator.clipboard.writeText(myGroup.accessCode);
                    setCopiedCode(true);
                    setTimeout(() => setCopiedCode(false), 2000);
                  }}
                >
                  {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {myGroup.accessCode}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 已報名列表 */}
        {slotData.registrations && slotData.registrations.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">報名名單 ({slotData.registrations.filter((r) => r.status !== "cancelled").length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {slotData.registrations
                  .filter((r) => r.status !== "cancelled")
                  .map((reg) => (
                    <div key={reg.id} className="flex items-center justify-between py-1 text-sm">
                      <span className="flex items-center gap-2">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {reg.displayName ?? reg.userId.slice(0, 8)}
                        {reg.registrationType === "premade_leader" && (
                          <Badge variant="outline" className="text-xs">隊長</Badge>
                        )}
                      </span>
                      <Badge variant="secondary" className="text-xs">{reg.skillLevel}</Badge>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 隊伍配對結果 */}
        {slotData.registrations?.some((r) => r.assignedTeam) && (
          <TeamsDisplay registrations={slotData.registrations} />
        )}
      </div>

      {/* 報名 Dialog */}
      <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>報名對戰</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>技能等級</Label>
              <Select value={skillLevel} onValueChange={setSkillLevel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">初學者</SelectItem>
                  <SelectItem value="intermediate">中級</SelectItem>
                  <SelectItem value="advanced">高手</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>備註（選填）</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => registerMutation.mutate()} disabled={registerMutation.isPending}>
              確認報名
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 建立小隊 Dialog */}
      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立預組小隊</DialogTitle>
          </DialogHeader>
          <div>
            <Label>小隊名稱（選填）</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={100} />
          </div>
          <DialogFooter>
            <Button onClick={() => createTeamMutation.mutate()} disabled={createTeamMutation.isPending}>
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加入小隊 Dialog */}
      <Dialog open={showJoinTeamDialog} onOpenChange={setShowJoinTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>用邀請碼加入小隊</DialogTitle>
          </DialogHeader>
          <div>
            <Label>邀請碼（6 碼）</Label>
            <Input
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="例如 ABC123"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => joinTeamMutation.mutate()}
              disabled={joinTeamMutation.isPending || accessCode.length < 6}
            >
              加入
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BattleLayout>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    open: { label: "開放報名", variant: "default" },
    confirmed: { label: "已成局", variant: "secondary" },
    full: { label: "已額滿", variant: "destructive" },
    in_progress: { label: "對戰中", variant: "outline" },
    completed: { label: "已結束", variant: "outline" },
    cancelled: { label: "已取消", variant: "destructive" },
  };
  const info = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

function TeamsDisplay({ registrations }: { registrations: RegistrationWithName[] }) {
  const teamMap = new Map<string, RegistrationWithName[]>();
  for (const reg of registrations) {
    if (reg.assignedTeam && reg.status !== "cancelled") {
      if (!teamMap.has(reg.assignedTeam)) {
        teamMap.set(reg.assignedTeam, []);
      }
      teamMap.get(reg.assignedTeam)!.push(reg);
    }
  }

  if (teamMap.size === 0) return null;

  const teamColors: Record<string, string> = {
    紅隊: "border-red-500/30 bg-red-500/10",
    藍隊: "border-blue-500/30 bg-blue-500/10",
    綠隊: "border-green-500/30 bg-green-500/10",
    黃隊: "border-yellow-500/30 bg-yellow-500/10",
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Swords className="h-4 w-4" /> 隊伍分配
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {Array.from(teamMap.entries()).map(([teamName, members]) => (
            <div
              key={teamName}
              className={`rounded-lg border p-3 ${teamColors[teamName] ?? "border-border bg-card"}`}
            >
              <p className="font-medium text-sm mb-2">{teamName} ({members.length}人)</p>
              <div className="space-y-1">
                {members.map((m) => (
                  <p key={m.id} className="text-xs text-muted-foreground">
                    {m.displayName ?? m.userId.slice(0, 8)}
                  </p>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
