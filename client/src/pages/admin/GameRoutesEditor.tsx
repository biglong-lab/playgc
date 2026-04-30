// 🎮 多腳本路線管理 admin UI
//
// 用法：admin 從 /admin/games/:gameId/routes 進入，管理該遊戲的多條路線
//
// 功能：
//   - 列表顯示所有 routes（含 isActive 狀態）
//   - 新增 / 編輯 / 刪除路線
//   - 啟用/停用切換
//   - 設定 startPageId（讓 route 對應到不同進入點）
import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Plus,
  Trash2,
  Edit2,
  Save,
  Compass,
  ArrowLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GameRoute {
  id: string;
  gameId: string;
  routeName: string;
  startPageId: string | null;
  description: string | null;
  difficulty: string | null;
  estimatedMinutes: number | null;
  isActive: boolean;
  sortOrder: number | null;
  createdAt: string;
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "🟢 簡單",
  medium: "🟡 中等",
  hard: "🔴 困難",
};

interface RouteFormState {
  routeName: string;
  startPageId: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_FORM: RouteFormState = {
  routeName: "",
  startPageId: "",
  description: "",
  difficulty: "medium",
  estimatedMinutes: 30,
  isActive: true,
  sortOrder: 0,
};

export default function GameRoutesEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState<GameRoute | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<RouteFormState>(EMPTY_FORM);

  const { data, isLoading } = useQuery<{ items: GameRoute[]; total: number }>({
    queryKey: ["/api/admin/games", gameId, "routes"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/admin/games/${gameId}/routes`);
      return res.json();
    },
    enabled: !!gameId,
  });

  const items = data?.items ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        routeName: form.routeName,
        startPageId: form.startPageId || undefined,
        description: form.description || undefined,
        difficulty: form.difficulty || undefined,
        estimatedMinutes: form.estimatedMinutes || undefined,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };
      if (editing) {
        const res = await apiRequest(
          "PATCH",
          `/api/admin/games/${gameId}/routes/${editing.id}`,
          body,
        );
        return res.json();
      } else {
        const res = await apiRequest("POST", `/api/admin/games/${gameId}/routes`, body);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games", gameId, "routes"] });
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast({ title: editing ? "✓ 已更新路線" : "✓ 已建立路線" });
    },
    onError: (err: Error) => {
      toast({ title: "❌ 儲存失敗", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (route: GameRoute) => {
      const res = await apiRequest(
        "PATCH",
        `/api/admin/games/${gameId}/routes/${route.id}`,
        { isActive: !route.isActive },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games", gameId, "routes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/admin/games/${gameId}/routes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/games", gameId, "routes"] });
      toast({ title: "✓ 已刪除路線" });
    },
    onError: (err: Error) => {
      toast({ title: "❌ 刪除失敗", description: err.message, variant: "destructive" });
    },
  });

  const openEdit = (route: GameRoute) => {
    setEditing(route);
    setForm({
      routeName: route.routeName,
      startPageId: route.startPageId ?? "",
      description: route.description ?? "",
      difficulty: route.difficulty ?? "medium",
      estimatedMinutes: route.estimatedMinutes ?? 30,
      isActive: route.isActive,
      sortOrder: route.sortOrder ?? 0,
    });
    setShowForm(true);
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, sortOrder: items.length });
    setShowForm(true);
  };

  return (
    <UnifiedAdminLayout title="🎮 多腳本路線管理">
      <div className="p-4 space-y-4 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setLocation(`/admin/games/${gameId}`)}
            data-testid="button-back-game"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            返回遊戲編輯
          </Button>
          <Button
            type="button"
            onClick={openCreate}
            className="ml-auto"
            data-testid="button-add-route"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增路線
          </Button>
        </div>

        {/* 說明 */}
        <Card className="bg-purple-50/50 dark:bg-purple-950/20 border-purple-200">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <Compass className="w-5 h-5 text-purple-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">多腳本架構（同一場域，多種劇情）</p>
                <p className="text-muted-foreground mt-1">
                  幫遊戲建立多條路線（例：英雄路線 / 間諜路線 / 考古路線），
                  玩家進入時可選一條走，提升重玩價值。
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              <Compass className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>尚未建立路線</p>
              <p className="text-xs mt-1">遊戲將以單一線性流程進行</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((route) => (
              <Card
                key={route.id}
                className={!route.isActive ? "opacity-60" : ""}
                data-testid={`route-card-${route.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{route.routeName}</h3>
                        {!route.isActive && (
                          <Badge variant="secondary" className="text-xs">已停用</Badge>
                        )}
                        {route.difficulty && (
                          <Badge variant="outline" className="text-xs">
                            {DIFFICULTY_LABELS[route.difficulty] ?? route.difficulty}
                          </Badge>
                        )}
                        {route.estimatedMinutes && (
                          <Badge variant="outline" className="text-xs">
                            {route.estimatedMinutes} 分鐘
                          </Badge>
                        )}
                      </div>
                      {route.description && (
                        <p className="text-sm text-muted-foreground">
                          {route.description}
                        </p>
                      )}
                      {route.startPageId && (
                        <p className="text-xs text-muted-foreground mt-1 font-mono">
                          進入: {route.startPageId}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <Switch
                        checked={route.isActive}
                        onCheckedChange={() => toggleActiveMutation.mutate(route)}
                        data-testid={`switch-active-${route.id}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(route)}
                        data-testid={`button-edit-${route.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm(`確定要刪除「${route.routeName}」？`)) {
                            deleteMutation.mutate(route.id);
                          }
                        }}
                        data-testid={`button-delete-${route.id}`}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 編輯/新增 dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "編輯路線" : "新增路線"}</DialogTitle>
              <DialogDescription>
                每條路線可有獨立的 startPageId、難度、預估時長
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">路線名稱 *</label>
                <Input
                  value={form.routeName}
                  onChange={(e) => setForm({ ...form, routeName: e.target.value })}
                  placeholder="英雄路線"
                  data-testid="input-route-name"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">開始 Page ID（選填）</label>
                <Input
                  value={form.startPageId}
                  onChange={(e) => setForm({ ...form, startPageId: e.target.value })}
                  placeholder="留空 = 從遊戲第一頁開始"
                  className="font-mono text-xs"
                  data-testid="input-start-page"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">描述</label>
                <Textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="這條路線的故事介紹..."
                  rows={3}
                  data-testid="textarea-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium mb-1 block">難度</label>
                  <Select
                    value={form.difficulty}
                    onValueChange={(v) => setForm({ ...form, difficulty: v })}
                  >
                    <SelectTrigger data-testid="select-difficulty">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">🟢 簡單</SelectItem>
                      <SelectItem value="medium">🟡 中等</SelectItem>
                      <SelectItem value="hard">🔴 困難</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">預估時長（分鐘）</label>
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={form.estimatedMinutes}
                    onChange={(e) =>
                      setForm({ ...form, estimatedMinutes: parseInt(e.target.value) || 30 })
                    }
                    data-testid="input-minutes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 p-2 border rounded">
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                    data-testid="switch-form-active"
                  />
                  <label className="text-sm">啟用此路線</label>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">顯示順序</label>
                  <Input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) =>
                      setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })
                    }
                    data-testid="input-sort-order"
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.routeName.trim()}
                data-testid="button-save"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                儲存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </UnifiedAdminLayout>
  );
}
