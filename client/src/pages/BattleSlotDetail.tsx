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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import { apiRequest, queryClient } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import SelfReportDialog from "@/components/battle/SelfReportDialog";
import { skillLevelLabel, slotStatusBadge } from "@/lib/battle-labels";
import { formatTimeUntil, isImminentSlot } from "@/lib/battle-time";
import type { BattleSlot, BattleVenue, BattleRegistration, BattlePremadeGroup } from "@shared/schema";
import {
  Swords, Clock, Users, CalendarDays, UserPlus,
  UserMinus, Shield, Copy, Check, CheckCircle, LogIn, Loader2,
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
  const [showCancelDialog, setShowCancelDialog] = useState(false); // 🔴 取消報名確認
  const [skillLevel, setSkillLevel] = useState("intermediate"); // 🔧 預設「中級」更合理
  const [notes, setNotes] = useState("");
  const [teamName, setTeamName] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);

  const { data: slotData, isLoading } = useQuery<SlotDetailResponse>({
    queryKey: ["/api/battle/slots", slotId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/battle/slots/${slotId}`);
      return res.json();
    },
    enabled: !!slotId,
  });

  const { data: venue } = useQuery<BattleVenue>({
    queryKey: ["/api/battle/venues", slotData?.venueId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/battle/venues/${slotData!.venueId}`);
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

  const confirmMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      return apiRequest("POST", `/api/battle/registrations/${registrationId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", slotId] });
      toast({ title: "已確認出席！" });
    },
    onError: (err: Error) => {
      toast({ title: "確認失敗", description: err.message, variant: "destructive" });
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
              {slotStatusBadge(slotData.status)}
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
                {/* 🚀 顯示距離時間（讓使用者一眼知道還有多久開戰） */}
                {(() => {
                  const label = formatTimeUntil(slotData.slotDate, slotData.startTime, slotData.endTime);
                  if (!label) return null;
                  const imminent = isImminentSlot(slotData.slotDate, slotData.startTime);
                  return (
                    <Badge
                      variant={imminent ? "default" : "outline"}
                      className={`text-xs ml-1 ${imminent ? "animate-pulse" : ""}`}
                    >
                      {label}
                    </Badge>
                  );
                })()}
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

            {/* 🚀 進度條：色階變化（人數越接近滿色越深，達成局人數轉綠色）*/}
            <div className="space-y-1">
              <div className="relative h-3 bg-muted rounded-full overflow-hidden">
                {/* 最低成局線（虛線標記）*/}
                <div
                  className="absolute top-0 bottom-0 border-l-2 border-dashed border-foreground/30 z-10"
                  style={{ left: `${Math.min((minPlayers / maxPlayers) * 100, 100)}%` }}
                  title={`最低成局：${minPlayers} 人`}
                />
                {/* 進度填充 */}
                <div
                  className={`h-full rounded-full transition-all ${
                    slotData.currentCount >= maxPlayers
                      ? "bg-red-500" // 滿了
                      : slotData.currentCount >= minPlayers
                        ? "bg-green-500" // 已成局
                        : "bg-primary" // 還沒成局
                  }`}
                  style={{ width: `${Math.min((slotData.currentCount / maxPlayers) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-right">
                {slotData.currentCount >= maxPlayers ? (
                  <span className="text-red-500 font-medium">⚠️ 已額滿</span>
                ) : slotData.currentCount >= minPlayers ? (
                  <span className="text-green-500 font-medium">✓ 已達成局人數</span>
                ) : (
                  <span className="text-muted-foreground">
                    還需 <strong className="text-primary">{minPlayers - slotData.currentCount}</strong> 人成局
                  </span>
                )}
              </p>
            </div>

            {slotData.notes && (
              <p className="text-sm text-muted-foreground bg-primary/5 rounded p-2">{slotData.notes}</p>
            )}
          </CardContent>
        </Card>

        {/* 操作按鈕 */}
        {!user && (slotData.status === "open" || slotData.status === "confirmed") && (
          <SlotLoginPrompt />
        )}
        <div className="flex gap-2">
          {canRegister && (
            <Button className="flex-1 gap-1" onClick={() => setShowRegisterDialog(true)}>
              <UserPlus className="h-4 w-4" /> 我要報名
            </Button>
          )}
          {isRegistered && myRegistration.status === "registered" &&
            (slotData.status === "confirmed" || slotData.status === "full") && (
            <Button
              variant="secondary"
              className="flex-1 gap-1"
              onClick={() => confirmMutation.mutate(myRegistration.id)}
              disabled={confirmMutation.isPending}
            >
              <CheckCircle className="h-4 w-4" /> 確認出席
            </Button>
          )}
          {isRegistered && myRegistration.status !== "checked_in" && myRegistration.status !== "confirmed" && (
            <Button
              variant="destructive"
              className="flex-1 gap-1"
              onClick={() => setShowCancelDialog(true)}
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
                      <span className="flex items-center gap-1">
                        {reg.status === "confirmed" && <CheckCircle className="h-3 w-3 text-green-500" />}
                        <Badge variant="secondary" className="text-xs">{skillLevelLabel(reg.skillLevel)}</Badge>
                      </span>
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
      <Dialog
        open={showRegisterDialog}
        onOpenChange={(o) => {
          // 🔒 報名中時禁止關閉 dialog（避免使用者中斷流程）
          if (registerMutation.isPending) return;
          setShowRegisterDialog(o);
        }}
      >
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
              <p className="text-xs text-muted-foreground mt-1">
                根據技能等級分配隊伍以平衡實力
              </p>
            </div>
            <div>
              <Label>備註（選填）</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={500}
                placeholder="例如：第一次參加、想跟朋友一隊"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {notes.length}/500
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => registerMutation.mutate()}
              disabled={registerMutation.isPending}
              className="gap-2"
            >
              {registerMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {registerMutation.isPending ? "報名中..." : "確認報名"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 建立小隊 Dialog */}
      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>建立報名小隊</DialogTitle>
          </DialogHeader>
          <div>
            <Label>小隊名稱（選填）</Label>
            <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} maxLength={100} />
          </div>
          <DialogFooter>
            <Button
              onClick={() => createTeamMutation.mutate()}
              disabled={createTeamMutation.isPending}
              className="gap-2"
            >
              {createTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {createTeamMutation.isPending ? "建立中..." : "建立"}
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
              className="gap-2"
            >
              {joinTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {joinTeamMutation.isPending ? "加入中..." : "加入"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 🔴 取消報名確認 Dialog — 避免誤觸不可逆操作 */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要取消報名？</AlertDialogTitle>
            <AlertDialogDescription>
              取消後若想再參加，需要重新報名。若該時段已額滿可能無法重新加入。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>不取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                cancelMutation.mutate();
                setShowCancelDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </BattleLayout>
  );
}

/** 時段頁面登入提示 */
function SlotLoginPrompt() {
  const [showLogin, setShowLogin] = useState(false);
  const handlers = useLoginHandlers(() => setShowLogin(false), { redirectTo: null });

  return (
    <>
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <p className="text-sm">登入後即可報名此時段</p>
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowLogin(true)}>
            <LogIn className="h-4 w-4" /> 登入
          </Button>
        </CardContent>
      </Card>
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={handlers}
      />
    </>
  );
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
