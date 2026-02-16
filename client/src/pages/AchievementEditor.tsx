import { useState, useEffect } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "@/components/AdminLayout";
import type { Achievement, Game } from "@shared/schema";
import { ChevronLeft, Plus, Trash2, Copy, Search, Trophy, EyeOff, Loader2 } from "lucide-react";
import {
  RARITY_TYPES, defaultFormData,
  getTypeInfo, getRarityInfo, getIconComponent,
  type AchievementFormData,
} from "./achievement-editor/constants";
import { AchievementFormDialog } from "./achievement-editor/AchievementFormDialog";

export default function AchievementEditor() {
  const { gameId } = useParams<{ gameId: string }>();
  const [location] = useLocation();
  const { toast } = useToast();

  const isAdminStaff = location.startsWith("/admin-staff");
  const basePath = isAdminStaff ? "/admin-staff/games" : "/admin/games";
  const apiBasePath = isAdminStaff ? "/api/admin/games" : "/api/games";

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [formData, setFormData] = useState<AchievementFormData>(defaultFormData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const { data: game } = useQuery<Game>({ queryKey: [apiBasePath, gameId] });
  const { data: achievements = [], isLoading } = useQuery<Achievement[]>({
    queryKey: [apiBasePath, gameId, "achievements"],
  });

  useEffect(() => {
    if (!selectedAchievement) return;
    const condition = (selectedAchievement.condition as AchievementFormData["condition"]) || { type: "visit_location" };
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
    onError: () => toast({ title: "創建失敗", variant: "destructive" }),
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
    onError: () => toast({ title: "更新失敗", variant: "destructive" }),
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
    onError: () => toast({ title: "刪除失敗", variant: "destructive" }),
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
    onError: () => toast({ title: "複製失敗", variant: "destructive" }),
  });

  const filteredAchievements = achievements.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.description?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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

  return (
    <AdminLayout
      title={`成就管理 - ${game?.title || "載入中..."}`}
      actions={
        <Link href={`${basePath}/${gameId}`}>
          <Button variant="outline" size="sm">
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回編輯器
          </Button>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* 搜尋 + 新增 */}
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

        {/* 稀有度統計 */}
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

        {/* 成就列表 */}
        <AchievementList
          achievements={filteredAchievements}
          isLoading={isLoading}
          onEdit={handleEditAchievement}
          onDuplicate={(a) => duplicateMutation.mutate(a)}
          onDelete={(id) => deleteMutation.mutate(id)}
          onCreateNew={handleCreateNew}
        />

        {/* 表單對話框 */}
        <AchievementFormDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          formData={formData}
          onFormDataChange={setFormData}
          onSave={handleSave}
          isCreating={isCreating}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      </div>
    </AdminLayout>
  );
}

// 成就列表元件（私有）
function AchievementList({
  achievements, isLoading, onEdit, onDuplicate, onDelete, onCreateNew,
}: {
  achievements: Achievement[];
  isLoading: boolean;
  onEdit: (a: Achievement) => void;
  onDuplicate: (a: Achievement) => void;
  onDelete: (id: number) => void;
  onCreateNew: () => void;
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (achievements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Trophy className="w-12 h-12 text-muted-foreground/50 mb-4" />
          <h3 className="font-medium text-lg mb-2">尚無成就</h3>
          <p className="text-muted-foreground text-sm mb-4">點擊「新增成就」來創建遊戲中的成就徽章</p>
          <Button onClick={onCreateNew}>
            <Plus className="w-4 h-4 mr-2" />
            新增第一個成就
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {achievements.map((achievement) => {
        const typeInfo = getTypeInfo(achievement.achievementType || "location");
        const rarityInfo = getRarityInfo(achievement.rarity || "common");
        const IconComponent = getIconComponent(achievement.iconUrl || "trophy");

        return (
          <Card
            key={achievement.id}
            className="cursor-pointer transition-all hover-elevate"
            onClick={() => onEdit(achievement)}
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
                    {achievement.isHidden && <EyeOff className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{achievement.description || "無描述"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-xs">
                      <typeInfo.icon className="w-3 h-3 mr-1" />
                      {typeInfo.label}
                    </Badge>
                    <Badge className={`text-xs ${rarityInfo.color}`}>{rarityInfo.label}</Badge>
                    <span className="text-xs text-muted-foreground ml-auto">+{achievement.points || 0} 點</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button variant="ghost" size="sm"
                  onClick={(e) => { e.stopPropagation(); onDuplicate(achievement); }}
                  data-testid={`button-duplicate-achievement-${achievement.id}`}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(achievement.id); }}
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
  );
}
