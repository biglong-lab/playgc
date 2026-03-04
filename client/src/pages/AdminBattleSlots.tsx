// 水彈對戰 PK 擂台 — 管理端時段管理 + 配對操作
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { BattleVenue, BattleSlot, BattleRegistration } from "@shared/schema";
import {
  Plus, Play, Square, Swords, Users, Clock,
  CalendarDays, XCircle, Shuffle, CheckCircle,
} from "lucide-react";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  open: { label: "開放報名", variant: "default" },
  confirmed: { label: "已成局", variant: "secondary" },
  full: { label: "已額滿", variant: "destructive" },
  in_progress: { label: "對戰中", variant: "outline" },
  completed: { label: "已結束", variant: "outline" },
  cancelled: { label: "已取消", variant: "destructive" },
};

export default function AdminBattleSlots() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState<string | null>(null);

  // 表單
  const [formDate, setFormDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("10:00");
  const [formEndTime, setFormEndTime] = useState("11:00");

  // 場地列表
  const { data: venues = [] } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues", admin?.fieldId],
    queryFn: async () => {
      if (!admin?.fieldId) return [];
      const res = await fetch(`/api/battle/venues?fieldId=${admin.fieldId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!admin?.fieldId,
  });

  // 時段列表
  const { data: slots = [], isLoading } = useQuery<BattleSlot[]>({
    queryKey: ["/api/battle/slots", selectedVenueId],
    queryFn: async () => {
      if (!selectedVenueId) return [];
      const res = await fetch(`/api/battle/slots?venueId=${selectedVenueId}`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedVenueId,
  });

  // 建立時段
  const createSlotMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/battle/slots", {
        venueId: selectedVenueId,
        slotDate: formDate,
        startTime: formStartTime,
        endTime: formEndTime,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", selectedVenueId] });
      toast({ title: "時段已建立" });
      setShowCreateDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  // 取消時段
  const cancelSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("POST", `/api/battle/slots/${slotId}/cancel`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", selectedVenueId] });
      toast({ title: "時段已取消" });
    },
  });

  // 開始對戰
  const startSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("POST", `/api/battle/slots/${slotId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", selectedVenueId] });
      toast({ title: "對戰已開始" });
    },
  });

  // 結束對戰
  const finishSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      return apiRequest("POST", `/api/battle/slots/${slotId}/finish`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", selectedVenueId] });
      toast({ title: "對戰已結束" });
    },
  });

  // 執行配對
  const matchmakeMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const res = await apiRequest("POST", `/api/battle/slots/${slotId}/matchmake`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/slots", selectedVenueId] });
      const totalAssigned = data.teams?.reduce(
        (sum: number, t: { members: unknown[] }) => sum + t.members.length,
        0,
      ) ?? 0;
      toast({ title: `配對完成！已分配 ${totalAssigned} 人` });
    },
    onError: (err: Error) => {
      toast({ title: "配對失敗", description: err.message, variant: "destructive" });
    },
  });

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  return (
    <UnifiedAdminLayout title="水彈對戰時段管理">
      <div className="space-y-4">
        {/* 場地選擇器 */}
        <div className="flex items-center gap-3">
          <Label className="whitespace-nowrap">選擇場地：</Label>
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="請選擇場地" />
            </SelectTrigger>
            <SelectContent>
              {venues.map((v) => (
                <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVenueId && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-1">
              <Plus className="h-4 w-4" /> 新增時段
            </Button>
          )}
        </div>

        {!selectedVenueId ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              請先選擇一個對戰場地
            </CardContent>
          </Card>
        ) : isLoading ? (
          <p className="text-muted-foreground">載入中...</p>
        ) : slots.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              此場地尚無時段
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => (
              <SlotCard
                key={slot.id}
                slot={slot}
                venue={selectedVenue}
                onCancel={() => cancelSlotMutation.mutate(slot.id)}
                onStart={() => startSlotMutation.mutate(slot.id)}
                onFinish={() => finishSlotMutation.mutate(slot.id)}
                onMatchmake={() => matchmakeMutation.mutate(slot.id)}
                onViewDetail={() => setShowDetailDialog(slot.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 建立時段 Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增時段</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>日期</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>開始時間</Label>
                <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
              </div>
              <div>
                <Label>結束時間</Label>
                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => createSlotMutation.mutate()} disabled={createSlotMutation.isPending || !formDate}>
              建立
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 時段詳情 Dialog */}
      {showDetailDialog && (
        <SlotDetailDialog
          slotId={showDetailDialog}
          onClose={() => setShowDetailDialog(null)}
        />
      )}
    </UnifiedAdminLayout>
  );
}

/** 時段卡片 */
function SlotCard({
  slot,
  venue,
  onCancel,
  onStart,
  onFinish,
  onMatchmake,
  onViewDetail,
}: {
  slot: BattleSlot;
  venue?: BattleVenue;
  onCancel: () => void;
  onStart: () => void;
  onFinish: () => void;
  onMatchmake: () => void;
  onViewDetail: () => void;
}) {
  const maxPlayers = slot.maxPlayersOverride ?? venue?.maxPlayers ?? 20;
  const statusInfo = STATUS_LABELS[slot.status] ?? { label: slot.status, variant: "outline" as const };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{slot.slotDate}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {slot.startTime?.slice(0, 5)} - {slot.endTime?.slice(0, 5)}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              {slot.currentCount}/{maxPlayers}
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={onViewDetail}>
              詳情
            </Button>
            {(slot.status === "confirmed" || slot.status === "full") && (
              <Button variant="outline" size="sm" className="gap-1" onClick={onMatchmake}>
                <Shuffle className="h-3 w-3" /> 配對
              </Button>
            )}
            {(slot.status === "confirmed" || slot.status === "full") && (
              <Button variant="default" size="sm" className="gap-1" onClick={onStart}>
                <Play className="h-3 w-3" /> 開始
              </Button>
            )}
            {slot.status === "in_progress" && (
              <Button variant="secondary" size="sm" className="gap-1" onClick={onFinish}>
                <Square className="h-3 w-3" /> 結束
              </Button>
            )}
            {slot.status === "open" && (
              <Button variant="ghost" size="sm" className="gap-1 text-destructive" onClick={onCancel}>
                <XCircle className="h-3 w-3" /> 取消
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** 時段詳情 Dialog — 顯示報名名單 + 配對結果 */
function SlotDetailDialog({ slotId, onClose }: { slotId: string; onClose: () => void }) {
  const { data, isLoading } = useQuery<{
    registrations: BattleRegistration[];
    premadeGroups: { id: string; name: string | null; memberCount: number; accessCode: string }[];
  }>({
    queryKey: ["/api/battle/slots", slotId, "registrations"],
    queryFn: async () => {
      const res = await fetch(`/api/battle/slots/${slotId}/registrations`, { credentials: "include" });
      if (!res.ok) throw new Error("載入失敗");
      return res.json();
    },
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5" /> 時段詳情
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-muted-foreground py-4">載入中...</p>
        ) : (
          <div className="space-y-4">
            {/* 報名列表 */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                報名列表 ({data?.registrations?.filter((r) => r.status !== "cancelled").length ?? 0})
              </h3>
              <div className="space-y-1">
                {data?.registrations
                  ?.filter((r) => r.status !== "cancelled")
                  .map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                      <span className="flex items-center gap-2">
                        {r.userId.slice(0, 12)}...
                        {r.registrationType !== "individual" && (
                          <Badge variant="outline" className="text-xs">
                            {r.registrationType === "premade_leader" ? "隊長" : "隊員"}
                          </Badge>
                        )}
                      </span>
                      <div className="flex items-center gap-2">
                        {r.assignedTeam && <Badge variant="secondary" className="text-xs">{r.assignedTeam}</Badge>}
                        <Badge variant="outline" className="text-xs">
                          {r.status === "checked_in" ? "已報到" : r.status === "confirmed" ? "已確認" : "已報名"}
                        </Badge>
                        {r.status === "checked_in" && <CheckCircle className="h-3 w-3 text-green-500" />}
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 預組小隊 */}
            {data?.premadeGroups && data.premadeGroups.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2">預組小隊 ({data.premadeGroups.length})</h3>
                <div className="space-y-2">
                  {data.premadeGroups.map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm p-2 bg-muted rounded">
                      <span>{g.name ?? "未命名小隊"} ({g.memberCount}人)</span>
                      <Badge variant="outline">{g.accessCode}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
