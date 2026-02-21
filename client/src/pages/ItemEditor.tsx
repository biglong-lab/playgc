import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";
import type { Item, Game } from "@shared/schema";
import {
  ChevronLeft, Plus, Save, Trash2, Copy, Search,
  Package, Sword, Scroll, Star, Zap, Shield, Heart,
  Key, Gem, Coins, Gift, Loader2
} from "lucide-react";

const ITEM_TYPES = [
  { value: "consumable", label: "消耗品", icon: Zap, description: "使用後消失的物品" },
  { value: "equipment", label: "裝備", icon: Shield, description: "可穿戴的物品" },
  { value: "quest_item", label: "任務道具", icon: Key, description: "完成任務所需的道具" },
  { value: "collectible", label: "收藏品", icon: Gem, description: "可收集的珍貴物品" },
];

const ITEM_ICONS = [
  { value: "package", icon: Package, label: "包裹" },
  { value: "sword", icon: Sword, label: "武器" },
  { value: "scroll", icon: Scroll, label: "卷軸" },
  { value: "star", icon: Star, label: "星星" },
  { value: "zap", icon: Zap, label: "能量" },
  { value: "shield", icon: Shield, label: "盾牌" },
  { value: "heart", icon: Heart, label: "生命" },
  { value: "key", icon: Key, label: "鑰匙" },
  { value: "gem", icon: Gem, label: "寶石" },
  { value: "coins", icon: Coins, label: "金幣" },
  { value: "gift", icon: Gift, label: "禮物" },
];

interface ItemFormData {
  name: string;
  description: string;
  itemType: string;
  iconUrl: string;
  effect: {
    type: string;
    value: number;
    description: string;
  };
}

const defaultFormData: ItemFormData = {
  name: "",
  description: "",
  itemType: "consumable",
  iconUrl: "package",
  effect: {
    type: "none",
    value: 0,
    description: "",
  },
};

export default function ItemEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Detect if we're in admin-staff context or admin context
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  // Use different API paths based on authentication context
  const apiBasePath = isAdminStaff ? "/api/admin/games" : "/api/games";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [formData, setFormData] = useState<ItemFormData>(defaultFormData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: game } = useQuery<Game>({
    queryKey: [apiBasePath, gameId],
  });

  const { data: items = [], isLoading } = useQuery<Item[]>({
    queryKey: [apiBasePath, gameId, "items"],
  });

  useEffect(() => {
    if (selectedItem) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- DB JSON 動態型別
      const effect = (selectedItem.effect as any) || { type: "none", value: 0, description: "" };
      setFormData({
        name: selectedItem.name,
        description: selectedItem.description || "",
        itemType: selectedItem.itemType || "consumable",
        iconUrl: selectedItem.iconUrl || "package",
        effect,
      });
    }
  }, [selectedItem]);

  const createMutation = useMutation({
    mutationFn: async (data: ItemFormData) => {
      const response = await apiRequest("POST", `${apiBasePath}/${gameId}/items`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "items"] });
      toast({ title: "道具已創建" });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "創建失敗", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ItemFormData> }) => {
      const endpoint = isAdminStaff ? `/api/admin/items/${id}` : `/api/items/${id}`;
      const response = await apiRequest("PATCH", endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "items"] });
      toast({ title: "道具已更新" });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const endpoint = isAdminStaff ? `/api/admin/items/${id}` : `/api/items/${id}`;
      await apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "items"] });
      toast({ title: "道具已刪除" });
      setSelectedItem(null);
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (item: Item) => {
      const response = await apiRequest("POST", `${apiBasePath}/${gameId}/items`, {
        name: `${item.name} (複製)`,
        description: item.description,
        itemType: item.itemType,
        iconUrl: item.iconUrl,
        effect: item.effect,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "items"] });
      toast({ title: "道具已複製" });
    },
    onError: () => {
      toast({ title: "複製失敗", variant: "destructive" });
    },
  });

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getItemTypeInfo = (type: string) => {
    return ITEM_TYPES.find(t => t.value === type) || ITEM_TYPES[0];
  };

  const getIconComponent = (iconName: string) => {
    const iconInfo = ITEM_ICONS.find(i => i.value === iconName);
    return iconInfo?.icon || Package;
  };

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedItem) {
      updateMutation.mutate({ id: selectedItem.id, data: formData });
    }
  };

  const handleCreateNew = () => {
    setSelectedItem(null);
    setFormData(defaultFormData);
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setSelectedItem(item);
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  return (
    <AdminLayout
      title={`道具管理 - ${game?.title || "載入中..."}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href={`${basePath}/${gameId}`}>
            <Button variant="outline" size="sm">
              <ChevronLeft className="w-4 h-4 mr-1" />
              返回編輯器
            </Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋道具..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-items"
            />
          </div>
          <Button onClick={handleCreateNew} data-testid="button-create-item">
            <Plus className="w-4 h-4 mr-2" />
            新增道具
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">尚無道具</h3>
              <p className="text-muted-foreground text-sm mb-4">
                點擊「新增道具」來創建遊戲中的道具
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                新增第一個道具
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredItems.map((item) => {
              const typeInfo = getItemTypeInfo(item.itemType || "consumable");
              const IconComponent = getIconComponent(item.iconUrl || "package");
              
              return (
                <Card
                  key={item.id}
                  className="cursor-pointer transition-all hover-elevate"
                  onClick={() => handleEditItem(item)}
                  data-testid={`card-item-${item.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <IconComponent className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{item.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {item.description || "無描述"}
                        </p>
                        <Badge variant="secondary" className="mt-2 text-xs">
                          <typeInfo.icon className="w-3 h-3 mr-1" />
                          {typeInfo.label}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateMutation.mutate(item);
                        }}
                        data-testid={`button-duplicate-item-${item.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(item.id);
                        }}
                        data-testid={`button-delete-item-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? "新增道具" : "編輯道具"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">道具名稱</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="輸入道具名稱"
                  data-testid="input-item-name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="輸入道具描述"
                  rows={3}
                  data-testid="input-item-description"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">道具類型</label>
                <Select
                  value={formData.itemType}
                  onValueChange={(value) => setFormData({ ...formData, itemType: value })}
                >
                  <SelectTrigger data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ITEM_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="w-4 h-4" />
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">圖示</label>
                <div className="grid grid-cols-6 gap-2">
                  {ITEM_ICONS.map((icon) => (
                    <button
                      key={icon.value}
                      type="button"
                      className={`p-3 rounded-lg border transition-colors ${
                        formData.iconUrl === icon.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                      onClick={() => setFormData({ ...formData, iconUrl: icon.value })}
                      title={icon.label}
                      data-testid={`button-icon-${icon.value}`}
                    >
                      <icon.icon className="w-5 h-5 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">效果類型</label>
                <Select
                  value={formData.effect.type}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    effect: { ...formData.effect, type: value }
                  })}
                >
                  <SelectTrigger data-testid="select-effect-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">無效果</SelectItem>
                    <SelectItem value="heal">恢復生命</SelectItem>
                    <SelectItem value="score">增加分數</SelectItem>
                    <SelectItem value="unlock">解鎖內容</SelectItem>
                    <SelectItem value="buff">增益效果</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.effect.type !== "none" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">效果數值</label>
                  <Input
                    type="number"
                    value={formData.effect.value}
                    onChange={(e) => setFormData({
                      ...formData,
                      effect: { ...formData.effect, value: parseInt(e.target.value) || 0 }
                    })}
                    placeholder="輸入效果數值"
                    data-testid="input-effect-value"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">取消</Button>
              </DialogClose>
              <Button
                onClick={handleSave}
                disabled={!formData.name || createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-item"
              >
                {(createMutation.isPending || updateMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                {isCreating ? "創建" : "儲存"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
