// 🎚️ AdminFeatureFlags — 元件遠端開關（Phase 4 / 2026-05-12）
//
// admin 可以：
//   1. 看所有 flag 列表（global + per-field）
//   2. toggle 任何元件 enabled / disabled（即時生效、不用 deploy）
//   3. 新增手動 flag

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Power, PowerOff, AlertTriangle, Bot, RefreshCw, Plus } from "lucide-react";

interface FeatureFlag {
  id: string;
  scope: string;
  fieldId: string | null;
  moduleKey: string;
  enabled: boolean;
  disabledReason: string | null;
  disabledAt: string | null;
  disabledBy: string | null;
  metrics: { failRate?: number; total?: number; errored?: number } | null;
  updatedAt: string;
}

export default function AdminFeatureFlags() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [newModule, setNewModule] = useState("");

  const { data, isLoading, refetch } = useQuery<{ flags: FeatureFlag[] }>({
    queryKey: ["/api/admin/feature-flags"],
    queryFn: async () => {
      const r = await apiRequest("GET", "/api/admin/feature-flags");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const toggleMut = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const r = await apiRequest("PATCH", `/api/admin/feature-flags/${id}`, { enabled });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "已更新" });
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
    },
    onError: (e) => toast({ title: "更新失敗", description: String(e), variant: "destructive" }),
  });

  const addMut = useMutation({
    mutationFn: async (moduleKey: string) => {
      const r = await apiRequest("POST", "/api/admin/feature-flags", {
        scope: "global",
        moduleKey,
        enabled: false,
        disabledReason: "manual",
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "已新增" });
      setNewModule("");
      qc.invalidateQueries({ queryKey: ["/api/admin/feature-flags"] });
    },
    onError: (e) => toast({ title: "新增失敗", description: String(e), variant: "destructive" }),
  });

  const flags = data?.flags ?? [];

  const reasonBadge = (reason: string | null) => {
    if (!reason) return null;
    if (reason === "manual") return <Badge variant="outline">手動關</Badge>;
    if (reason === "auto:high_failure")
      return <Badge className="bg-red-600 text-white"><Bot className="w-3 h-3 mr-1" />高失敗率</Badge>;
    if (reason === "auto:low_completion")
      return <Badge className="bg-orange-600 text-white"><Bot className="w-3 h-3 mr-1" />完成率低</Badge>;
    return <Badge variant="outline">{reason}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">🎚️ 元件遠端開關</h1>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-2">
          <Input
            placeholder="輸入 componentType（如 trivia_showdown）手動新增 disabled flag"
            value={newModule}
            onChange={(e) => setNewModule(e.target.value)}
            data-testid="input-new-module"
          />
          <Button
            disabled={!newModule || addMut.isPending}
            onClick={() => addMut.mutate(newModule.trim())}
            data-testid="btn-add-flag"
          >
            <Plus className="w-4 h-4 mr-1" />
            新增（預設關閉）
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-3">
          <CardTitle className="text-base">所有 flag（{flags.length}）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && <div className="p-8 text-center text-muted-foreground">載入中...</div>}
          {!isLoading && flags.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              尚無 flag。所有元件預設啟用。
              <p className="text-xs mt-1">
                自動降級 cron 偵測到高失敗率會自動新增、admin 也可手動新增
              </p>
            </div>
          )}
          {flags.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">元件</th>
                    <th className="px-3 py-2 text-left">範圍</th>
                    <th className="px-3 py-2 text-center">狀態</th>
                    <th className="px-3 py-2 text-left">原因</th>
                    <th className="px-3 py-2 text-left">關閉時間</th>
                    <th className="px-3 py-2 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {flags.map((f) => (
                    <tr key={f.id} className="border-t" data-testid={`flag-${f.moduleKey}`}>
                      <td className="px-3 py-2 font-mono text-xs">{f.moduleKey}</td>
                      <td className="px-3 py-2 text-xs">
                        {f.scope === "global" ? "全平台" : `場域 ${f.fieldId?.slice(0, 8)}…`}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {f.enabled ? (
                          <Badge className="bg-emerald-500 text-white">
                            <Power className="w-3 h-3 mr-1" />啟用
                          </Badge>
                        ) : (
                          <Badge variant="destructive">
                            <PowerOff className="w-3 h-3 mr-1" />關閉
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {reasonBadge(f.disabledReason)}
                        {f.metrics && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5">
                            {f.metrics.errored ?? 0}/{f.metrics.total ?? 0} 錯誤 ({Math.round((f.metrics.failRate ?? 0) * 100)}%)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {f.disabledAt ? new Date(f.disabledAt).toLocaleString("zh-TW") : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant={f.enabled ? "outline" : "default"}
                          disabled={toggleMut.isPending}
                          onClick={() => toggleMut.mutate({ id: f.id, enabled: !f.enabled })}
                          data-testid={`btn-toggle-${f.moduleKey}`}
                        >
                          {f.enabled ? "停用" : "啟用"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        ⓘ 自動降級 cron：每小時掃一次、過去 1h 內某元件 errored 比例 &gt; 50%（樣本 ≥ 10）自動關閉。
        恢復健康後自動 re-enable。manual 手動關閉的不會被自動恢復。
      </p>
    </div>
  );
}
