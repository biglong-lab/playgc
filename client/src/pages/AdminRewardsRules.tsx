// 場域 admin — 獎勵規則管理頁
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §26.10
//
// 功能：
//   - 列出規則（含啟用狀態、優先級、觸發次數、配額）
//   - 啟用/停用切換
//   - 建/編輯規則（觸發條件 + 獎勵 JSON 編輯）
//   - 軟刪除（isActive=false）
//
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, Edit, Trash2, Sparkles, AlertCircle } from "lucide-react";

interface RewardRule {
  id: string;
  name: string;
  description?: string | null;
  fieldId?: string | null;
  isActive: boolean;
  triggers: Record<string, unknown>;
  rewards: Array<Record<string, unknown>>;
  quota?: Record<string, unknown> | null;
  priority: number;
  hitsCount: number;
  createdAt: string;
  validUntil?: string | null;
}

const TEMPLATE_TRIGGERS: Record<string, Record<string, unknown>> = {
  "10 場新人": { eventType: "game_complete", minTotalGames: 10 },
  "跨場域首航": { eventType: "game_complete", firstVisit: true },
  "MVP": { eventType: "game_complete", result: ["win"] },
  "100 場名人堂": { eventType: "game_complete", minTotalGames: 100 },
  "招募達人": { eventType: "recruit", minRecruits: 10 },
};

const TEMPLATE_REWARDS: Record<string, Array<Record<string, unknown>>> = {
  "50 元平台券": [{ type: "platform_coupon", templateId: "TPL_NEWBIE_50", target: "squad" }],
  "100 元平台券": [{ type: "platform_coupon", templateId: "TPL_VETERAN_100", target: "squad" }],
  "500 元獎金 + 徽章": [
    { type: "platform_coupon", templateId: "TPL_LEGEND_500", target: "squad" },
    { type: "badge", value: "hall_of_fame", metadata: { displayName: "名人堂", category: "milestone" } },
  ],
};

export default function AdminRewardsRules() {
  const { toast } = useToast();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<RewardRule | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 表單欄位
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPriority, setFormPriority] = useState(0);
  const [formTriggersJson, setFormTriggersJson] = useState(
    '{"eventType": "game_complete", "minTotalGames": 10}',
  );
  const [formRewardsJson, setFormRewardsJson] = useState(
    '[{"type": "platform_coupon", "templateId": "TPL_NEWBIE_50", "target": "squad"}]',
  );
  const [formQuotaJson, setFormQuotaJson] = useState('{"perSquad": 1}');
  // 🆕 Phase 17.4：A/B Testing 欄位
  const [formAbTestGroup, setFormAbTestGroup] = useState<string>("");
  const [formAbTestTraffic, setFormAbTestTraffic] = useState(100);

  const { data: rules = [], isLoading } = useQuery<RewardRule[]>({
    queryKey: ["/api/admin/rules"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/rules");
      return res.json();
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (rule: RewardRule) => {
      const res = await apiRequest("PATCH", `/api/admin/rules/${rule.id}`, {
        isActive: !rule.isActive,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules"] });
      toast({ title: "規則狀態已更新" });
    },
    onError: (err: Error) => {
      toast({ title: "切換失敗", description: err.message, variant: "destructive" });
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // 驗證 JSON
      let triggers: Record<string, unknown>;
      let rewards: Array<Record<string, unknown>>;
      let quota: Record<string, unknown> | undefined;
      try {
        triggers = JSON.parse(formTriggersJson);
        rewards = JSON.parse(formRewardsJson);
        if (formQuotaJson.trim()) quota = JSON.parse(formQuotaJson);
      } catch (err) {
        throw new Error("JSON 格式錯誤：" + (err as Error).message);
      }

      const body = {
        name: formName,
        description: formDescription || undefined,
        isActive: formIsActive,
        priority: formPriority,
        triggers,
        rewards,
        quota,
        abTestGroup: formAbTestGroup || null,
        abTestTraffic: formAbTestTraffic,
      };

      if (editingRule) {
        const res = await apiRequest("PATCH", `/api/admin/rules/${editingRule.id}`, body);
        return res.json();
      } else {
        const res = await apiRequest("POST", "/api/admin/rules", body);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules"] });
      toast({ title: editingRule ? "規則已更新" : "規則已建立" });
      setShowEditDialog(false);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: "儲存失敗", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/rules"] });
      toast({ title: "規則已停用" });
      setShowDeleteDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "刪除失敗", description: err.message, variant: "destructive" });
    },
  });

  function resetForm() {
    setFormName("");
    setFormDescription("");
    setFormIsActive(true);
    setFormPriority(0);
    setFormTriggersJson('{"eventType": "game_complete", "minTotalGames": 10}');
    setFormRewardsJson('[{"type": "platform_coupon", "templateId": "TPL_NEWBIE_50", "target": "squad"}]');
    setFormQuotaJson('{"perSquad": 1}');
    setFormAbTestGroup("");
    setFormAbTestTraffic(100);
    setEditingRule(null);
  }

  function openCreate() {
    resetForm();
    setShowEditDialog(true);
  }

  function openEdit(rule: RewardRule) {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDescription(rule.description ?? "");
    setFormIsActive(rule.isActive);
    setFormPriority(rule.priority);
    setFormTriggersJson(JSON.stringify(rule.triggers, null, 2));
    setFormRewardsJson(JSON.stringify(rule.rewards, null, 2));
    setFormQuotaJson(rule.quota ? JSON.stringify(rule.quota, null, 2) : "");
    setShowEditDialog(true);
  }

  return (
    <UnifiedAdminLayout title="獎勵規則管理">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              獎勵規則管理
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              玩家完成遊戲時，規則引擎會自動評估這些規則並發券
            </p>
          </div>
          <Button onClick={openCreate} className="gap-1.5">
            <Plus className="h-4 w-4" />
            新增規則
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : rules.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              尚無規則 — 按右上「新增規則」開始
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id} className={rule.isActive ? "" : "opacity-60"}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <Badge variant={rule.isActive ? "default" : "outline"} className="text-xs">
                          {rule.isActive ? "啟用中" : "已停用"}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          P{rule.priority}
                        </Badge>
                      </div>
                      {rule.description && (
                        <p className="text-sm text-muted-foreground mb-2">{rule.description}</p>
                      )}
                      <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                        <div>
                          <p className="text-muted-foreground mb-0.5">觸發條件</p>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] block truncate">
                            {JSON.stringify(rule.triggers)}
                          </code>
                        </div>
                        <div>
                          <p className="text-muted-foreground mb-0.5">獎勵</p>
                          <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] block truncate">
                            {rule.rewards.map((r) => r.type).join(", ")}
                          </code>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                        <span>觸發次數：{rule.hitsCount}</span>
                        {rule.quota && (
                          <span>配額：{JSON.stringify(rule.quota)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => toggleMutation.mutate(rule)}
                        disabled={toggleMutation.isPending}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEdit(rule)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setDeletingId(rule.id);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 編輯/建立 Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "編輯規則" : "新增規則"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>規則名稱</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="🌱 打滿 10 場新人賀禮"
                maxLength={100}
              />
            </div>
            <div>
              <Label>描述（選填）</Label>
              <Input
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="累計 10 場後送 50 元平台券"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>優先級（數字越大越優先）</Label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Switch
                  checked={formIsActive}
                  onCheckedChange={setFormIsActive}
                  id="active-switch"
                />
                <Label htmlFor="active-switch">啟用</Label>
              </div>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                觸發條件（JSON）
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => {
                    const tpl = Object.entries(TEMPLATE_TRIGGERS);
                    const next = tpl[Math.floor(Math.random() * tpl.length)];
                    setFormTriggersJson(JSON.stringify(next[1], null, 2));
                  }}
                >
                  填範例
                </Button>
              </Label>
              <Textarea
                value={formTriggersJson}
                onChange={(e) => setFormTriggersJson(e.target.value)}
                rows={4}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                可用：eventType / gameTypes / result / minTotalGames / crossField / firstVisit / minSquadTier / minRecruits
              </p>
            </div>

            <div>
              <Label className="flex items-center gap-2">
                獎勵清單（JSON 陣列）
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => {
                    const tpl = Object.entries(TEMPLATE_REWARDS);
                    const next = tpl[Math.floor(Math.random() * tpl.length)];
                    setFormRewardsJson(JSON.stringify(next[1], null, 2));
                  }}
                >
                  填範例
                </Button>
              </Label>
              <Textarea
                value={formRewardsJson}
                onChange={(e) => setFormRewardsJson(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                type 可選：platform_coupon / external_coupon / exp_points / badge
              </p>
            </div>

            <div>
              <Label>配額（JSON，選填）</Label>
              <Input
                value={formQuotaJson}
                onChange={(e) => setFormQuotaJson(e.target.value)}
                className="font-mono text-xs"
                placeholder='{"perSquad": 1, "perDay": 3}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowEditDialog(false)}
              disabled={saveMutation.isPending}
            >
              取消
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !formName}
            >
              {saveMutation.isPending ? "儲存中..." : editingRule ? "更新" : "建立"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認 */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認停用此規則？</AlertDialogTitle>
            <AlertDialogDescription>
              停用後，新發生的事件將不會觸發此規則。歷史已發出的獎勵不受影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認停用
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnifiedAdminLayout>
  );
}
