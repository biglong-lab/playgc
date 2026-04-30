// 🔧 平台批量操作（P2-1）
//
// 用於 super_admin 一次處理多個場域：
//   - 批量變更狀態（active / inactive / suspended）
//   - 批量變更訂閱方案
//
// 設計：場域列表 with checkbox → 工具列選操作 → 預覽 → 確認執行
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Settings, Search, Building2, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FieldRow {
  field: {
    id: string;
    name: string;
    code: string;
    status: string | null;
  };
  plan: { id: string; code: string; name: string } | null;
  subscription: { status: string } | null;
}

interface Plan {
  id: string;
  code: string;
  name: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "啟用",
  inactive: "停用",
  suspended: "暫停",
};

export default function PlatformBulkOps() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [operation, setOperation] = useState<"none" | "status" | "plan">("none");
  const [targetStatus, setTargetStatus] = useState<string>("active");
  const [targetPlanId, setTargetPlanId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);

  // 列表
  const { data: rows, isLoading } = useQuery<FieldRow[]>({
    queryKey: ["/api/platform/fields"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/fields");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  // 方案列表
  const { data: plans } = useQuery<Plan[]>({
    queryKey: ["/api/platform/plans"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/plans");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const fields = rows ?? [];

  const filtered = useMemo(() => {
    if (!searchQuery) return fields;
    const q = searchQuery.toLowerCase();
    return fields.filter(
      (f) =>
        f.field.name.toLowerCase().includes(q) ||
        f.field.code.toLowerCase().includes(q),
    );
  }, [fields, searchQuery]);

  const selectedFields = useMemo(
    () => fields.filter((f) => selectedIds.has(f.field.id)),
    [fields, selectedIds],
  );

  // 全選/取消全選
  const allFilteredSelected =
    filtered.length > 0 && filtered.every((f) => selectedIds.has(f.field.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((f) => next.delete(f.field.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      filtered.forEach((f) => next.add(f.field.id));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // 批量狀態變更
  const bulkStatusMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/fields/bulk-status", {
        fieldIds: Array.from(selectedIds),
        status: targetStatus,
        reason: reason || undefined,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fields"] });
      setSelectedIds(new Set());
      setConfirming(false);
      setOperation("none");
      toast({
        title: "✅ 批量變更狀態完成",
        description: `成功更新 ${data.updatedCount} 個場域${data.skipped > 0 ? `（跳過 ${data.skipped} 個）` : ""}`,
      });
    },
    onError: (err) => {
      toast({
        title: "批量變更失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // 批量方案變更
  const bulkPlanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/platform/fields/bulk-plan", {
        fieldIds: Array.from(selectedIds),
        planId: targetPlanId,
      });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/fields"] });
      setSelectedIds(new Set());
      setConfirming(false);
      setOperation("none");
      toast({
        title: "✅ 批量變更方案完成",
        description: `更新 ${data.updatedCount}、新建 ${data.createdCount}`,
      });
    },
    onError: (err) => {
      toast({
        title: "批量變更失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const isPending = bulkStatusMutation.isPending || bulkPlanMutation.isPending;

  const handleExecute = () => {
    if (operation === "status") {
      bulkStatusMutation.mutate();
    } else if (operation === "plan") {
      bulkPlanMutation.mutate();
    }
  };

  const targetPlan = plans?.find((p) => p.id === targetPlanId);

  return (
    <PlatformAdminLayout title="批量操作">
      {/* 工具列 */}
      <Card className="mb-4 border-primary/30 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="font-semibold">批量操作工具列</h3>
            <Badge variant="default" className="ml-auto tabular-nums">
              已選 {selectedIds.size} / {fields.length} 場域
            </Badge>
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <Select value={operation} onValueChange={(v) => setOperation(v as typeof operation)}>
              <SelectTrigger className="w-full md:w-44">
                <SelectValue placeholder="選擇操作" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">- 選擇操作 -</SelectItem>
                <SelectItem value="status">變更場域狀態</SelectItem>
                <SelectItem value="plan">變更訂閱方案</SelectItem>
              </SelectContent>
            </Select>

            {operation === "status" && (
              <>
                <Select value={targetStatus} onValueChange={setTargetStatus}>
                  <SelectTrigger className="w-full md:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">啟用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="suspended">暫停</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="原因（選填，會記入稽核）"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="flex-1"
                />
              </>
            )}

            {operation === "plan" && (
              <Select value={targetPlanId} onValueChange={setTargetPlanId}>
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue placeholder="選擇方案" />
                </SelectTrigger>
                <SelectContent>
                  {plans?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}（{p.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Button
              disabled={
                operation === "none" ||
                selectedIds.size === 0 ||
                (operation === "plan" && !targetPlanId)
              }
              onClick={() => setConfirming(true)}
              className="ml-auto"
            >
              預覽並執行
            </Button>
          </div>
          {selectedIds.size === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              💡 從下方列表勾選要操作的場域
            </p>
          )}
        </CardContent>
      </Card>

      {/* 搜尋 */}
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="搜尋場域名稱或代碼..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 全選 */}
      <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-muted/30 rounded">
        <Checkbox
          checked={allFilteredSelected}
          onCheckedChange={toggleAll}
          data-testid="checkbox-select-all"
        />
        <label className="text-sm cursor-pointer" onClick={toggleAll}>
          {allFilteredSelected ? "取消全選" : "全選顯示中"}（{filtered.length}）
        </label>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : (
        <div className="space-y-1" data-testid="bulk-fields-list">
          {filtered.map((row) => {
            const f = row.field;
            const checked = selectedIds.has(f.id);
            return (
              <Card
                key={f.id}
                className={`cursor-pointer hover-elevate ${checked ? "border-primary bg-primary/5" : ""}`}
                onClick={() => toggleOne(f.id)}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <Checkbox checked={checked} onCheckedChange={() => toggleOne(f.id)} />
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {f.code} · 狀態：
                      <span className={`ml-1 font-medium ${
                        f.status === "active" ? "text-emerald-500" :
                        f.status === "suspended" ? "text-destructive" :
                        "text-muted-foreground"
                      }`}>
                        {STATUS_LABELS[f.status ?? ""] ?? f.status}
                      </span>
                      {row.plan && (
                        <>
                          {" · 方案："}
                          <span className="font-medium text-foreground">{row.plan.name}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* 確認 dialog */}
      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認批量操作</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  即將對 <strong className="text-foreground">{selectedIds.size}</strong> 個場域執行：
                </p>
                {operation === "status" ? (
                  <div className="bg-muted/30 rounded p-2">
                    <span className="font-mono">場域狀態</span>
                    {" → "}
                    <Badge>{STATUS_LABELS[targetStatus]}</Badge>
                    {reason && <p className="text-xs text-muted-foreground mt-1">原因：{reason}</p>}
                  </div>
                ) : (
                  <div className="bg-muted/30 rounded p-2">
                    <span className="font-mono">訂閱方案</span>
                    {" → "}
                    <Badge>{targetPlan?.name ?? "未選擇"}</Badge>
                  </div>
                )}

                {/* 變更預覽 */}
                <div className="max-h-48 overflow-y-auto bg-muted/20 rounded p-2 space-y-1">
                  {selectedFields.slice(0, 10).map((f) => (
                    <div key={f.field.id} className="flex items-center gap-2 text-xs">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      <span className="font-medium">{f.field.name}</span>
                      <span className="text-muted-foreground">{f.field.code}</span>
                      <ArrowRight className="w-3 h-3 ml-auto text-muted-foreground" />
                    </div>
                  ))}
                  {selectedFields.length > 10 && (
                    <div className="text-xs text-muted-foreground italic">
                      ... 還有 {selectedFields.length - 10} 個場域
                    </div>
                  )}
                </div>

                <p className="text-xs text-amber-600">
                  ⚠️ 此操作會記錄到稽核日誌，無法自動還原
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleExecute}
              disabled={isPending}
            >
              {isPending ? "執行中..." : "確認執行"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlatformAdminLayout>
  );
}
