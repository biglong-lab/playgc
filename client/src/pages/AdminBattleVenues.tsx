// 水彈對戰 PK 擂台 — 管理端場地管理
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
import type { BattleVenue } from "@shared/schema";
import { Plus, Settings, Trash2, Swords, Users, Clock } from "lucide-react";

export default function AdminBattleVenues() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editVenue, setEditVenue] = useState<BattleVenue | null>(null);

  // 表單狀態
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState("water_gun");
  const [formMinPlayers, setFormMinPlayers] = useState(8);
  const [formMaxPlayers, setFormMaxPlayers] = useState(20);
  const [formTeamSize, setFormTeamSize] = useState(5);
  const [formMaxTeams, setFormMaxTeams] = useState(2);
  const [formDuration, setFormDuration] = useState(60);

  const { data: venues = [], isLoading } = useQuery<BattleVenue[]>({
    queryKey: ["/api/battle/venues", admin?.fieldId],
    queryFn: async () => {
      if (!admin?.fieldId) return [];
      const res = await fetch(`/api/battle/venues?fieldId=${admin.fieldId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!admin?.fieldId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/battle/venues", {
        name: formName,
        venueType: formType,
        minPlayers: formMinPlayers,
        maxPlayers: formMaxPlayers,
        teamSize: formTeamSize,
        maxTeams: formMaxTeams,
        gameDurationMinutes: formDuration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/venues"] });
      toast({ title: "場地已建立" });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "建立失敗", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editVenue) return;
      return apiRequest("PATCH", `/api/battle/venues/${editVenue.id}`, {
        name: formName,
        venueType: formType,
        minPlayers: formMinPlayers,
        maxPlayers: formMaxPlayers,
        teamSize: formTeamSize,
        maxTeams: formMaxTeams,
        gameDurationMinutes: formDuration,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/venues"] });
      toast({ title: "場地已更新" });
      setEditVenue(null);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "更新失敗", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/battle/venues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/battle/venues"] });
      toast({ title: "場地已停用" });
    },
  });

  function resetForm() {
    setFormName("");
    setFormType("water_gun");
    setFormMinPlayers(8);
    setFormMaxPlayers(20);
    setFormTeamSize(5);
    setFormMaxTeams(2);
    setFormDuration(60);
  }

  function openEdit(venue: BattleVenue) {
    setEditVenue(venue);
    setFormName(venue.name);
    setFormType(venue.venueType);
    setFormMinPlayers(venue.minPlayers);
    setFormMaxPlayers(venue.maxPlayers);
    setFormTeamSize(venue.teamSize);
    setFormMaxTeams(venue.maxTeams);
    setFormDuration(venue.gameDurationMinutes);
  }

  const venueTypeLabel: Record<string, string> = {
    water_gun: "水彈槍",
    paintball: "漆彈",
    laser: "雷射",
    nerf: "Nerf",
    airsoft: "BB 彈",
  };

  return (
    <UnifiedAdminLayout title="水彈對戰場地管理">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Swords className="h-5 w-5" />
            對戰場地 ({venues.length})
          </h2>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-1">
            <Plus className="h-4 w-4" /> 新增場地
          </Button>
        </div>

        {isLoading ? (
          <p className="text-muted-foreground">載入中...</p>
        ) : venues.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              尚未建立任何對戰場地，請點擊「新增場地」開始設定
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <Card key={venue.id} className="relative">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center justify-between">
                    {venue.name}
                    <Badge variant="outline">{venueTypeLabel[venue.venueType] ?? venue.venueType}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center gap-4 text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {venue.minPlayers}-{venue.maxPlayers} 人
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {venue.gameDurationMinutes} 分鐘
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {venue.maxTeams} 隊 × {venue.teamSize} 人/隊
                  </p>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="gap-1" onClick={() => openEdit(venue)}>
                      <Settings className="h-3 w-3" /> 編輯
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-destructive"
                      onClick={() => deleteMutation.mutate(venue.id)}
                    >
                      <Trash2 className="h-3 w-3" /> 停用
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 建立/編輯 Dialog */}
      <Dialog
        open={showCreateDialog || !!editVenue}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setEditVenue(null);
            resetForm();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editVenue ? "編輯場地" : "新增場地"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>場地名稱</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>
            <div>
              <Label>場地類型</Label>
              <Select value={formType} onValueChange={setFormType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="water_gun">水彈槍</SelectItem>
                  <SelectItem value="paintball">漆彈</SelectItem>
                  <SelectItem value="laser">雷射</SelectItem>
                  <SelectItem value="nerf">Nerf</SelectItem>
                  <SelectItem value="airsoft">BB 彈</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>最低人數</Label>
                <Input type="number" value={formMinPlayers} onChange={(e) => setFormMinPlayers(+e.target.value)} />
              </div>
              <div>
                <Label>最高人數</Label>
                <Input type="number" value={formMaxPlayers} onChange={(e) => setFormMaxPlayers(+e.target.value)} />
              </div>
              <div>
                <Label>每隊人數</Label>
                <Input type="number" value={formTeamSize} onChange={(e) => setFormTeamSize(+e.target.value)} />
              </div>
              <div>
                <Label>隊伍數量</Label>
                <Input type="number" value={formMaxTeams} onChange={(e) => setFormMaxTeams(+e.target.value)} />
              </div>
            </div>
            <div>
              <Label>對戰時長（分鐘）</Label>
              <Input type="number" value={formDuration} onChange={(e) => setFormDuration(+e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => (editVenue ? updateMutation.mutate() : createMutation.mutate())}
              disabled={createMutation.isPending || updateMutation.isPending || !formName}
            >
              {editVenue ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </UnifiedAdminLayout>
  );
}
