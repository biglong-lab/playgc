import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";
import type { Achievement, Game } from "@shared/schema";
import {
  ChevronLeft, Plus, Save, Trash2, Copy, Search,
  Trophy, MapPin, Star, Zap, Clock, Target, Crown,
  Award, Medal, Sparkles, Eye, EyeOff, Loader2
} from "lucide-react";

const ACHIEVEMENT_TYPES = [
  { value: "location", label: "地點探索", icon: MapPin, description: "到達特定地點解鎖" },
  { value: "collection", label: "收集成就", icon: Star, description: "收集指定物品解鎖" },
  { value: "speed", label: "速度挑戰", icon: Clock, description: "在時限內完成任務" },
  { value: "exploration", label: "探險成就", icon: Target, description: "探索隱藏區域" },
  { value: "special", label: "特殊成就", icon: Sparkles, description: "完成特殊條件" },
  { value: "legendary", label: "傳說成就", icon: Crown, description: "極難達成的成就" },
];

const RARITY_TYPES = [
  { value: "common", label: "普通", color: "bg-gray-500/20 text-gray-400", points: 10 },
  { value: "uncommon", label: "稀有", color: "bg-green-500/20 text-green-400", points: 25 },
  { value: "rare", label: "珍貴", color: "bg-blue-500/20 text-blue-400", points: 50 },
  { value: "epic", label: "史詩", color: "bg-purple-500/20 text-purple-400", points: 100 },
  { value: "legendary", label: "傳說", color: "bg-orange-500/20 text-orange-400", points: 200 },
];

const ACHIEVEMENT_ICONS = [
  { value: "trophy", icon: Trophy, label: "獎盃" },
  { value: "star", icon: Star, label: "星星" },
  { value: "medal", icon: Medal, label: "獎牌" },
  { value: "award", icon: Award, label: "獎狀" },
  { value: "crown", icon: Crown, label: "皇冠" },
  { value: "sparkles", icon: Sparkles, label: "閃耀" },
  { value: "target", icon: Target, label: "目標" },
  { value: "zap", icon: Zap, label: "閃電" },
  { value: "mappin", icon: MapPin, label: "地標" },
];

interface AchievementFormData {
  name: string;
  description: string;
  achievementType: string;
  rarity: string;
  points: number;
  iconUrl: string;
  isHidden: boolean;
  condition: {
    type: string;
    target?: string;
    count?: number;
  };
}

const defaultFormData: AchievementFormData = {
  name: "",
  description: "",
  achievementType: "location",
  rarity: "common",
  points: 10,
  iconUrl: "trophy",
  isHidden: false,
  condition: {
    type: "visit_location",
  },
};

export default function AchievementEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location] = useLocation();
  const { toast } = useToast();
  
  // Detect if we're in admin-staff context or admin context
  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  // Use different API paths based on authentication context
  const apiBasePath = isAdminStaff ? "/api/admin/games" : "/api/games";
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [formData, setFormData] = useState<AchievementFormData>(defaultFormData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: game } = useQuery<Game>({
    queryKey: [apiBasePath, gameId],
  });

  const { data: achievements = [], isLoading } = useQuery<Achievement[]>({
    queryKey: [apiBasePath, gameId, "achievements"],
  });

  useEffect(() => {
    if (selectedAchievement) {
      const condition = (selectedAchievement.condition as any) || { type: "visit_location" };
      setFormData({
        name: selectedAchievement.name,
        description: selectedAchievement.description || "",
        achievementType: selectedAchievement.achievementType || "location",
        rarity: selectedAchievement.rarity || "common",
        points: selectedAchievement.points || 10,
        iconUrl: selectedAchievement.iconUrl || "trophy",
        isHidden: selectedAchievement.isHidden || false,
        condition,
      });
    }
  }, [selectedAchievement]);

  const createMutation = useMutation({
    mutationFn: async (data: AchievementFormData) => {
      const response = await apiRequest("POST", `${apiBasePath}/${gameId}/achievements`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "achievements"] });
      toast({ title: "成就已創建" });
      setIsDialogOpen(false);
      setFormData(defaultFormData);
      setIsCreating(false);
    },
    onError: () => {
      toast({ title: "創建失敗", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<AchievementFormData> }) => {
      const endpoint = isAdminStaff ? `/api/admin/achievements/${id}` : `/api/achievements/${id}`;
      const response = await apiRequest("PATCH", endpoint, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "achievements"] });
      toast({ title: "成就已更新" });
    },
    onError: () => {
      toast({ title: "更新失敗", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const endpoint = isAdminStaff ? `/api/admin/achievements/${id}` : `/api/achievements/${id}`;
      await apiRequest("DELETE", endpoint);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "achievements"] });
      toast({ title: "成就已刪除" });
      setSelectedAchievement(null);
    },
    onError: () => {
      toast({ title: "刪除失敗", variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (achievement: Achievement) => {
      const response = await apiRequest("POST", `${apiBasePath}/${gameId}/achievements`, {
        name: `${achievement.name} (複製)`,
        description: achievement.description,
        achievementType: achievement.achievementType,
        rarity: achievement.rarity,
        points: achievement.points,
        iconUrl: achievement.iconUrl,
        isHidden: achievement.isHidden,
        condition: achievement.condition,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [apiBasePath, gameId, "achievements"] });
      toast({ title: "成就已複製" });
    },
    onError: () => {
      toast({ title: "複製失敗", variant: "destructive" });
    },
  });

  const filteredAchievements = achievements.filter(achievement =>
    achievement.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (achievement.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getTypeInfo = (type: string) => {
    return ACHIEVEMENT_TYPES.find(t => t.value === type) || ACHIEVEMENT_TYPES[0];
  };

  const getRarityInfo = (rarity: string) => {
    return RARITY_TYPES.find(r => r.value === rarity) || RARITY_TYPES[0];
  };

  const getIconComponent = (iconName: string) => {
    const iconInfo = ACHIEVEMENT_ICONS.find(i => i.value === iconName);
    return iconInfo?.icon || Trophy;
  };

  const handleSave = () => {
    if (isCreating) {
      createMutation.mutate(formData);
    } else if (selectedAchievement) {
      updateMutation.mutate({ id: selectedAchievement.id, data: formData });
    }
  };

  const handleCreateNew = () => {
    setSelectedAchievement(null);
    setFormData(defaultFormData);
    setIsCreating(true);
    setIsDialogOpen(true);
  };

  const handleEditAchievement = (achievement: Achievement) => {
    setSelectedAchievement(achievement);
    setIsCreating(false);
    setIsDialogOpen(true);
  };

  const handleRarityChange = (value: string) => {
    const rarityInfo = getRarityInfo(value);
    setFormData({
      ...formData,
      rarity: value,
      points: rarityInfo.points,
    });
  };

  return (
    <AdminLayout
      title={`成就管理 - ${game?.title || "載入中..."}`}
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
              placeholder="搜尋成就..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              data-testid="input-search-achievements"
            />
          </div>
          <Button onClick={handleCreateNew} data-testid="button-create-achievement">
            <Plus className="w-4 h-4 mr-2" />
            新增成就
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-4">
          {RARITY_TYPES.map((rarity) => {
            const count = achievements.filter(a => a.rarity === rarity.value).length;
            return (
              <Card key={rarity.value} className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${rarity.color} flex items-center justify-center`}>
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground">{rarity.label}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredAchievements.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-lg mb-2">尚無成就</h3>
              <p className="text-muted-foreground text-sm mb-4">
                點擊「新增成就」來創建遊戲中的成就徽章
              </p>
              <Button onClick={handleCreateNew}>
                <Plus className="w-4 h-4 mr-2" />
                新增第一個成就
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAchievements.map((achievement) => {
              const typeInfo = getTypeInfo(achievement.achievementType || "location");
              const rarityInfo = getRarityInfo(achievement.rarity || "common");
              const IconComponent = getIconComponent(achievement.iconUrl || "trophy");
              
              return (
                <Card
                  key={achievement.id}
                  className="cursor-pointer transition-all hover-elevate"
                  onClick={() => handleEditAchievement(achievement)}
                  data-testid={`card-achievement-${achievement.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-14 h-14 rounded-lg ${rarityInfo.color} flex items-center justify-center shrink-0`}>
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{achievement.name}</h3>
                          {achievement.isHidden && (
                            <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {achievement.description || "無描述"}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs">
                            <typeInfo.icon className="w-3 h-3 mr-1" />
                            {typeInfo.label}
                          </Badge>
                          <Badge className={`text-xs ${rarityInfo.color}`}>
                            {rarityInfo.label}
                          </Badge>
                          <span className="text-xs text-muted-foreground ml-auto">
                            +{achievement.points || 0} 點
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateMutation.mutate(achievement);
                        }}
                        data-testid={`button-duplicate-achievement-${achievement.id}`}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(achievement.id);
                        }}
                        data-testid={`button-delete-achievement-${achievement.id}`}
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
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {isCreating ? "新增成就" : "編輯成就"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">成就名稱</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="輸入成就名稱"
                  data-testid="input-achievement-name"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">描述</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="輸入成就描述"
                  rows={2}
                  data-testid="input-achievement-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">成就類型</label>
                  <Select
                    value={formData.achievementType}
                    onValueChange={(value) => setFormData({ ...formData, achievementType: value })}
                  >
                    <SelectTrigger data-testid="select-achievement-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACHIEVEMENT_TYPES.map((type) => (
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
                  <label className="text-sm font-medium">稀有度</label>
                  <Select
                    value={formData.rarity}
                    onValueChange={handleRarityChange}
                  >
                    <SelectTrigger data-testid="select-achievement-rarity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RARITY_TYPES.map((rarity) => (
                        <SelectItem key={rarity.value} value={rarity.value}>
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${rarity.color}`} />
                            <span>{rarity.label}</span>
                            <span className="text-muted-foreground text-xs">({rarity.points}點)</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">獎勵點數</label>
                <Input
                  type="number"
                  value={formData.points}
                  onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) || 0 })}
                  placeholder="輸入點數"
                  data-testid="input-achievement-points"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">圖示</label>
                <div className="grid grid-cols-5 gap-2">
                  {ACHIEVEMENT_ICONS.map((icon) => (
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

              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="font-medium text-sm">隱藏成就</p>
                  <p className="text-xs text-muted-foreground">解鎖前不會顯示給玩家</p>
                </div>
                <Switch
                  checked={formData.isHidden}
                  onCheckedChange={(checked) => setFormData({ ...formData, isHidden: checked })}
                  data-testid="switch-hidden"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">解鎖條件類型</label>
                <Select
                  value={formData.condition.type}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    condition: { ...formData.condition, type: value }
                  })}
                >
                  <SelectTrigger data-testid="select-condition-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit_location">到達地點</SelectItem>
                    <SelectItem value="collect_items">收集道具</SelectItem>
                    <SelectItem value="complete_mission">完成任務</SelectItem>
                    <SelectItem value="score_threshold">達到分數</SelectItem>
                    <SelectItem value="time_limit">時間限制</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.condition.type === "score_threshold" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">目標分數</label>
                  <Input
                    type="number"
                    value={formData.condition.count || 0}
                    onChange={(e) => setFormData({
                      ...formData,
                      condition: { ...formData.condition, count: parseInt(e.target.value) || 0 }
                    })}
                    placeholder="輸入目標分數"
                    data-testid="input-condition-count"
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
                data-testid="button-save-achievement"
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
