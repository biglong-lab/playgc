// 場域行銷與互動設定頁 — Phase 12.6
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §13 §14 §16 §18
//
// 功能：
//   1. 超級隊長條件設定（場次/招募/場域/勝率門檻）
//   2. 歡迎隊伍模式設定（auto / manual / hybrid）
//   3. 通知設定（5 類型開關 + 冷卻時間）
//   4. 休眠規則（天數 + 召回信日期）
//   5. 段位場次門檻
//   6. 通知頻道管理（CRUD email/line/discord/webhook）
//
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Crown,
  Sparkles,
  Bell,
  Moon,
  Trophy,
  Loader2,
  Save,
  Settings,
} from "lucide-react";

interface EngagementSettings {
  fieldId: string;
  superLeaderMinGames: number;
  superLeaderMinRecruits: number;
  superLeaderMinFields: number;
  superLeaderMinWinRate: number;
  superLeaderAutoEnabled: boolean;
  superLeaderManualIds: string[];
  welcomeMode: "auto" | "manual" | "hybrid";
  welcomeAutoTopN: number;
  welcomeAutoCriteria: "total_games" | "rating" | "recent_active";
  welcomeManualIds: string[];
  notificationChannels: string[];
  notifyOnFirstGame: boolean;
  notifyOnRankChange: boolean;
  notifyOnRewardIssued: boolean;
  notifyOnTierUpgrade: boolean;
  notifyOnDormancyWarning: boolean;
  notificationCooldownHours: number;
  dormancyDaysThreshold: number;
  dormancyWarningDays: number[];
  tierGamesThresholds: {
    newbie?: number;
    active?: number;
    veteran?: number;
    legend?: number;
  };
  isDefault?: boolean;
}

export default function AdminEngagementSettings() {
  const { admin } = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const fieldId = admin?.fieldId ?? "";

  const { data: settings, isLoading } = useQuery<EngagementSettings>({
    queryKey: ["/api/admin/engagement/settings", fieldId],
    queryFn: () =>
      fetchWithAdminAuth(`/api/admin/engagement/settings/${fieldId}`),
    enabled: !!fieldId,
  });

  const [draft, setDraft] = useState<Partial<EngagementSettings>>({});

  const merged: EngagementSettings | null = settings
    ? { ...settings, ...draft }
    : null;

  const saveMutation = useMutation({
    mutationFn: (payload: Partial<EngagementSettings>) =>
      fetchWithAdminAuth(`/api/admin/engagement/settings/${fieldId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast({ title: "設定已儲存" });
      qc.invalidateQueries({
        queryKey: ["/api/admin/engagement/settings", fieldId],
      });
      setDraft({});
    },
    onError: (err: Error) => {
      toast({
        title: "儲存失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const runAchievementsMutation = useMutation({
    mutationFn: () =>
      fetchWithAdminAuth(`/api/admin/engagement/run-achievements`, {
        method: "POST",
      }),
    onSuccess: (data: any) => {
      toast({
        title: "成就計算完成",
        description: `處理 ${data.squadsProcessed} 隊，發放 ${data.achievementsAwarded} 個成就`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: "成就計算失敗",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  function update<K extends keyof EngagementSettings>(
    key: K,
    value: EngagementSettings[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (Object.keys(draft).length === 0) {
      toast({ title: "沒有變更" });
      return;
    }
    saveMutation.mutate(draft);
  }

  if (isLoading || !merged) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            場域行銷與互動設定
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            超級隊長 / 歡迎隊伍 / 通知 / 休眠規則
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending || Object.keys(draft).length === 0}
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          儲存
        </Button>
      </div>

      <Tabs defaultValue="super-leader" className="space-y-4">
        <TabsList className="grid grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="super-leader" className="gap-1">
            <Crown className="w-4 h-4" />
            超級隊長
          </TabsTrigger>
          <TabsTrigger value="welcome" className="gap-1">
            <Sparkles className="w-4 h-4" />
            歡迎隊伍
          </TabsTrigger>
          <TabsTrigger value="notification" className="gap-1">
            <Bell className="w-4 h-4" />
            通知
          </TabsTrigger>
          <TabsTrigger value="dormancy" className="gap-1">
            <Moon className="w-4 h-4" />
            休眠
          </TabsTrigger>
          <TabsTrigger value="tier" className="gap-1">
            <Trophy className="w-4 h-4" />
            段位
          </TabsTrigger>
        </TabsList>

        {/* 超級隊長 */}
        <TabsContent value="super-leader">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">超級隊長條件</CardTitle>
              <p className="text-xs text-muted-foreground">
                達到所有條件的隊長會自動取得超級隊長身份（招募獎勵 ×2 / 場域曝光）
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>啟用自動超級隊長計算</Label>
                <Switch
                  checked={merged.superLeaderAutoEnabled}
                  onCheckedChange={(v) =>
                    update("superLeaderAutoEnabled", v)
                  }
                />
              </div>
              <NumberField
                label="最少場次"
                value={merged.superLeaderMinGames}
                onChange={(v) => update("superLeaderMinGames", v)}
                min={1}
              />
              <NumberField
                label="最少招募人數"
                value={merged.superLeaderMinRecruits}
                onChange={(v) => update("superLeaderMinRecruits", v)}
                min={0}
              />
              <NumberField
                label="最少跨場域數"
                value={merged.superLeaderMinFields}
                onChange={(v) => update("superLeaderMinFields", v)}
                min={1}
              />
              <NumberField
                label="最低勝率（%）"
                value={merged.superLeaderMinWinRate}
                onChange={(v) => update("superLeaderMinWinRate", v)}
                min={0}
                max={100}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 歡迎隊伍 */}
        <TabsContent value="welcome">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">歡迎隊伍設定</CardTitle>
              <p className="text-xs text-muted-foreground">
                新玩家進入場域時推薦的隊伍清單
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>推薦模式</Label>
                <Select
                  value={merged.welcomeMode}
                  onValueChange={(v) =>
                    update("welcomeMode", v as EngagementSettings["welcomeMode"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">自動（按條件取 top N）</SelectItem>
                    <SelectItem value="manual">手動指定</SelectItem>
                    <SelectItem value="hybrid">混合（手動優先 + 自動補）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {merged.welcomeMode !== "manual" && (
                <>
                  <NumberField
                    label="自動取前 N 名"
                    value={merged.welcomeAutoTopN}
                    onChange={(v) => update("welcomeAutoTopN", v)}
                    min={1}
                    max={20}
                  />
                  <div className="space-y-2">
                    <Label>排序條件</Label>
                    <Select
                      value={merged.welcomeAutoCriteria}
                      onValueChange={(v) =>
                        update(
                          "welcomeAutoCriteria",
                          v as EngagementSettings["welcomeAutoCriteria"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="total_games">總場次（活躍指標）</SelectItem>
                        <SelectItem value="rating">分數（高手優先）</SelectItem>
                        <SelectItem value="recent_active">最近活躍</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通知 */}
        <TabsContent value="notification">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">通知事件</CardTitle>
              <p className="text-xs text-muted-foreground">
                控制系統會通知玩家哪些事件
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ToggleRow
                label="首次上榜通知"
                checked={merged.notifyOnFirstGame}
                onCheckedChange={(v) => update("notifyOnFirstGame", v)}
              />
              <ToggleRow
                label="排名變動通知"
                checked={merged.notifyOnRankChange}
                onCheckedChange={(v) => update("notifyOnRankChange", v)}
              />
              <ToggleRow
                label="獎勵發放通知"
                checked={merged.notifyOnRewardIssued}
                onCheckedChange={(v) => update("notifyOnRewardIssued", v)}
              />
              <ToggleRow
                label="段位升級通知"
                checked={merged.notifyOnTierUpgrade}
                onCheckedChange={(v) => update("notifyOnTierUpgrade", v)}
              />
              <ToggleRow
                label="休眠召回通知"
                checked={merged.notifyOnDormancyWarning}
                onCheckedChange={(v) =>
                  update("notifyOnDormancyWarning", v)
                }
              />
              <NumberField
                label="冷卻時間（小時）"
                value={merged.notificationCooldownHours}
                onChange={(v) => update("notificationCooldownHours", v)}
                min={0}
                max={720}
                hint="同一玩家在這段時間內不會收到重複類型的通知"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 休眠 */}
        <TabsContent value="dormancy">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">休眠規則</CardTitle>
              <p className="text-xs text-muted-foreground">
                隊伍多久沒活動會被標記休眠 + 召回信時程
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <NumberField
                label="休眠天數門檻"
                value={merged.dormancyDaysThreshold}
                onChange={(v) => update("dormancyDaysThreshold", v)}
                min={1}
                max={365}
                hint="超過這個天數沒活動 → 標記休眠"
              />
              <div className="space-y-2">
                <Label>召回信日期（用逗號分隔）</Label>
                <Input
                  type="text"
                  value={(merged.dormancyWarningDays ?? []).join(",")}
                  onChange={(e) => {
                    const arr = e.target.value
                      .split(",")
                      .map((s) => parseInt(s.trim(), 10))
                      .filter((n) => !Number.isNaN(n) && n > 0);
                    update("dormancyWarningDays", arr);
                  }}
                  placeholder="3,7,14"
                />
                <p className="text-xs text-muted-foreground">
                  例：3,7,14 表示第 3、7、14 天各送一封召回信
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 段位 */}
        <TabsContent value="tier">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">段位場次門檻</CardTitle>
              <p className="text-xs text-muted-foreground">
                控制玩家在排行榜上顯示的段位等級
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <NumberField
                label="新人（場）"
                value={merged.tierGamesThresholds?.newbie ?? 1}
                onChange={(v) =>
                  update("tierGamesThresholds", {
                    ...merged.tierGamesThresholds,
                    newbie: v,
                  })
                }
                min={1}
              />
              <NumberField
                label="活躍（場）"
                value={merged.tierGamesThresholds?.active ?? 10}
                onChange={(v) =>
                  update("tierGamesThresholds", {
                    ...merged.tierGamesThresholds,
                    active: v,
                  })
                }
                min={1}
              />
              <NumberField
                label="資深（場）"
                value={merged.tierGamesThresholds?.veteran ?? 50}
                onChange={(v) =>
                  update("tierGamesThresholds", {
                    ...merged.tierGamesThresholds,
                    veteran: v,
                  })
                }
                min={1}
              />
              <NumberField
                label="傳說（場）"
                value={merged.tierGamesThresholds?.legend ?? 100}
                onChange={(v) =>
                  update("tierGamesThresholds", {
                    ...merged.tierGamesThresholds,
                    legend: v,
                  })
                }
                min={1}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 維運操作 */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">維運操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">手動觸發成就計算</p>
              <p className="text-xs text-muted-foreground">
                通常每 6 小時自動跑一次，需要立即發放可手動觸發
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => runAchievementsMutation.mutate()}
              disabled={runAchievementsMutation.isPending}
            >
              {runAchievementsMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trophy className="w-4 h-4 mr-2" />
              )}
              立即計算
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(n);
        }}
        min={min}
        max={max}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b last:border-b-0">
      <Label>{label}</Label>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
