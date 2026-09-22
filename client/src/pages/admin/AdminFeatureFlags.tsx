// 🎚️ AdminFeatureFlags — 元件遠端開關（Phase 4 / 2026-05-12）
//
// admin 可以：
//   1. 看 flag 列表（全平台 + 本場域；super_admin 看全部）
//   2. toggle 元件 enabled / disabled（即時生效、不用 deploy）
//   3. 新增手動 flag
//
// 🔒 2026-09-23 P0-B：以前新增預設「全平台」、任何管理員都能切 → 場域管理員能關掉所有場域的元件
//   現在：非 super_admin 只能新增 / 切換本場域覆寫（全平台列唯讀）；新增預設本場域；
//   新增與切換前都跳確認框寫明影響範圍（後端同規則把關，見 server/routes/admin-feature-flags.ts）

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { isSuperAdmin, type FeatureFlag, type FlagScope, type PendingFlagAction } from "./feature-flags/flag-scope";
import { FlagConfirmDialog } from "./feature-flags/FlagConfirmDialog";
import { AddFlagCard } from "./feature-flags/AddFlagCard";
import { FlagsTable } from "./feature-flags/FlagsTable";

const FLAGS_KEY = ["/api/admin/feature-flags"];

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function useFlagMutations() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: FLAGS_KEY });

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await apiRequest("PATCH", `/api/admin/feature-flags/${id}`, { enabled });
      return r.json();
    },
    onSuccess: () => { toast({ title: "已更新" }); refresh(); },
    onError: (e) => toast({ title: "更新失敗", description: errorText(e), variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: async ({ moduleKey, scope }: { moduleKey: string; scope: FlagScope }) => {
      const r = await apiRequest("POST", "/api/admin/feature-flags", {
        scope, moduleKey, enabled: false, disabledReason: "manual",
      });
      return r.json();
    },
    onSuccess: () => { toast({ title: "已新增" }); refresh(); },
    onError: (e) => toast({ title: "新增失敗", description: errorText(e), variant: "destructive" }),
  });

  return { toggleMut, addMut };
}

function PageHeader({ onRefresh }: { onRefresh: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold">🎚️ 元件遠端開關</h1>
      <Button variant="outline" size="sm" onClick={onRefresh} aria-label="重新整理">
        <RefreshCw className="w-4 h-4" />
      </Button>
    </div>
  );
}

function FootNote({ superAdmin }: { superAdmin: boolean }) {
  return (
    <p className="text-xs text-muted-foreground">
      ⓘ 自動降級 cron：每小時掃一次、過去 1h 內某元件 errored 比例 &gt; 50%（樣本 ≥ 10）自動關閉。
      恢復健康後自動 re-enable。manual 手動關閉的不會被自動恢復。
      {!superAdmin && " 全平台開關由平台管理員維護；要只在本場域關閉某元件，請用上方「新增」。"}
    </p>
  );
}

function EmptyState() {
  return (
    <div className="p-8 text-center text-muted-foreground">
      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
      尚無 flag。所有元件預設啟用。
      <p className="text-xs mt-1">自動降級 cron 偵測到高失敗率會自動新增、admin 也可手動新增</p>
    </div>
  );
}

export default function AdminFeatureFlags() {
  const { admin } = useAdminAuth();
  const superAdmin = isSuperAdmin(admin);
  const [pending, setPending] = useState<PendingFlagAction | null>(null);
  const { toggleMut, addMut } = useFlagMutations();

  const { data, isLoading, refetch } = useQuery<{ flags: FeatureFlag[] }>({
    queryKey: FLAGS_KEY,
    queryFn: async () => (await apiRequest("GET", "/api/admin/feature-flags")).json(),
    refetchInterval: 30_000,
  });
  const flags = data?.flags ?? [];

  const confirm = (action: PendingFlagAction) => {
    setPending(null);
    if (action.kind === "add") addMut.mutate({ moduleKey: action.moduleKey, scope: action.scope });
    else toggleMut.mutate({ id: action.flag.id, enabled: action.enabled });
  };
  const requestToggle = (flag: FeatureFlag) => setPending({ kind: "toggle", flag, enabled: !flag.enabled });

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-5xl">
      <PageHeader onRefresh={() => refetch()} />

      <AddFlagCard
        isSuperAdmin={superAdmin}
        fieldName={admin?.fieldName}
        disabled={addMut.isPending}
        onRequestAdd={(moduleKey, scope) => setPending({ kind: "add", moduleKey, scope })}
      />

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-base">{superAdmin ? "所有 flag" : "全平台 + 本場域 flag"}（{flags.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">載入中...</div>}
          {!isLoading && flags.length === 0 && <EmptyState />}
          {flags.length > 0 && (
            <FlagsTable flags={flags} admin={admin} togglePending={toggleMut.isPending} onRequestToggle={requestToggle} />
          )}
        </CardContent>
      </Card>

      <FootNote superAdmin={superAdmin} />

      <FlagConfirmDialog pending={pending} fieldName={admin?.fieldName} onCancel={() => setPending(null)} onConfirm={confirm} />
    </div>
  );
}
