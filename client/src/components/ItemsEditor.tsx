import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Package, Sparkles, Shield, Star, Zap } from "lucide-react";
import type { Item, InsertItem } from "@shared/schema";

interface ItemsEditorProps {
  gameId: string;
  useAdminApi?: boolean;
}

const ITEM_TYPES = [
  { value: "consumable", label: "消耗品", icon: Zap, color: "bg-green-500/20 text-green-400" },
  { value: "equipment", label: "裝備", icon: Shield, color: "bg-blue-500/20 text-blue-400" },
  { value: "quest_item", label: "任務道具", icon: Star, color: "bg-yellow-500/20 text-yellow-400" },
  { value: "collectible", label: "收藏品", icon: Sparkles, color: "bg-purple-500/20 text-purple-400" },
];

const getItemTypeInfo = (type: string | null) => {
  return ITEM_TYPES.find((t) => t.value === type) || ITEM_TYPES[0];
};

export default function ItemsEditor({ gameId, useAdminApi = false }: ItemsEditorProps) {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deleteItem, setDeleteItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<Partial<InsertItem>>({
    name: "",
    description: "",
    iconUrl: "",
    itemType: "consumable",
    effect: {},
  });

  const apiBase = useAdminApi ? "/api/admin" : "/api";
  const queryKeyBase = useAdminApi ? "/api/admin/games" : "/api/games";

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: [queryKeyBase, gameId, "items"],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/games/${gameId}/items`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch items");
      return res.json();
    },
    enabled: !!gameId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertItem>) => {
      const res = await fetch(`${apiBase}/games/${gameId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase, gameId, "items"] });
      toast({ title: "道具已建立" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "建立失敗", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertItem> }) => {
      const res = await fetch(`${apiBase}/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to update item");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase, gameId, "items"] });
      toast({ title: "道具已更新" });
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "更新失敗", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${apiBase}/items/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete item");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyBase, gameId, "items"] });
      toast({ title: "道具已刪除" });
      setDeleteItem(null);
    },
    onError: (error: Error) => {
      toast({ title: "刪除失敗", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      iconUrl: "",
      itemType: "consumable",
      effect: {},
    });
    setEditingItem(null);
    setIsDialogOpen(false);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || "",
      iconUrl: item.iconUrl || "",
      itemType: item.itemType || "consumable",
      effect: item.effect || {},
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name?.trim()) {
      toast({ title: "請輸入道具名稱", variant: "destructive" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Package className="h-5 w-5" />
            道具管理
          </h3>
          <p className="text-sm text-muted-foreground">
            建立遊戲中可獲得的道具，可在任務中作為獎勵
          </p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-item">
          <Plus className="h-4 w-4 mr-2" />
          新增道具
        </Button>
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">尚未建立任何道具</p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setIsDialogOpen(true)}
            >
              建立第一個道具
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const typeInfo = getItemTypeInfo(item.itemType);
            const Icon = typeInfo.icon;
            return (
              <Card key={item.id} className="group" data-testid={`card-item-${item.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${typeInfo.color}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <Badge variant="outline" className="text-xs mt-1">
                          {typeInfo.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(item)}
                        data-testid={`button-edit-item-${item.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteItem(item)}
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {item.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.iconUrl && (
                    <div className="mt-2 flex items-center gap-2">
                      <img
                        src={item.iconUrl}
                        alt={item.name}
                        className="w-8 h-8 rounded object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingItem ? "編輯道具" : "新增道具"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "修改道具資訊" : "建立新的遊戲道具"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">道具名稱 *</label>
                <Input
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="輸入道具名稱"
                  required
                  data-testid="input-item-name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">道具類型</label>
                <Select
                  value={formData.itemType || "consumable"}
                  onValueChange={(value) => setFormData({ ...formData, itemType: value })}
                >
                  <SelectTrigger data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="輸入道具描述"
                  rows={3}
                  data-testid="input-item-description"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">圖示網址</label>
                <Input
                  value={formData.iconUrl || ""}
                  onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                  placeholder="https://example.com/icon.png"
                  data-testid="input-item-icon"
                />
                {formData.iconUrl && (
                  <div className="flex items-center gap-2 mt-2">
                    <img
                      src={formData.iconUrl}
                      alt="預覽"
                      className="w-10 h-10 rounded object-cover border"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <span className="text-xs text-muted-foreground">圖示預覽</span>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit-item"
              >
                {editingItem ? "更新" : "建立"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除這個道具嗎？</AlertDialogTitle>
            <AlertDialogDescription>
              將刪除「{deleteItem?.name}」，此操作無法復原。
              如果任務中有使用此道具作為獎勵，可能會影響遊戲設定。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
