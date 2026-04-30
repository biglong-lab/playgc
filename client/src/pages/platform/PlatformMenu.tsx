// 🗂️ 平台選單管理（Menu Management）
//
// 對 PLATFORM_MENU_GROUPS（hardcoded）做即時 override：
//  - 顯示/隱藏（visible）
//  - 自訂顯示名稱（customLabel）
//  - 排序（sortOrder，分組內由小到大）
//  - 變更分組（customGroup）
//
// 變更會即時反映到 PlatformAdminLayout（refetchInterval=60s 或下次重新整理）
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  PLATFORM_MENU_GROUPS,
  applyMenuOverrides,
  type PlatformMenuOverrideMap,
  type PlatformMenuOverride,
} from "@/config/platform-menu";
import { ListTree, Eye, EyeOff, RotateCcw, Save, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface MenuOverridesData {
  map: PlatformMenuOverrideMap;
  total: number;
}

/**
 * 每個 item 的本地編輯狀態
 */
interface LocalOverride {
  visible: boolean;
  customLabel: string;
  sortOrder: number;
  customGroup: string;
}

function buildLocalState(overrides: PlatformMenuOverrideMap): Record<string, LocalOverride> {
  const result: Record<string, LocalOverride> = {};
  for (const group of PLATFORM_MENU_GROUPS) {
    for (const item of group.items) {
      const o = overrides[item.path];
      result[item.path] = {
        visible: o?.visible ?? true,
        customLabel: o?.customLabel ?? "",
        sortOrder: o?.sortOrder ?? 0,
        customGroup: o?.customGroup ?? "",
      };
    }
  }
  return result;
}

function isDirty(local: LocalOverride, remote: PlatformMenuOverride | undefined): boolean {
  const r: PlatformMenuOverride = remote ?? {
    visible: true,
    customLabel: null,
    sortOrder: 0,
    customGroup: null,
  };
  return (
    local.visible !== r.visible ||
    (local.customLabel || null) !== (r.customLabel || null) ||
    local.sortOrder !== r.sortOrder ||
    (local.customGroup || null) !== (r.customGroup || null)
  );
}

export default function PlatformMenu() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<MenuOverridesData>({
    queryKey: ["/api/platform/menu-overrides"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/menu-overrides")).json(),
    enabled: isAuthenticated,
  });

  const [local, setLocal] = useState<Record<string, LocalOverride>>({});

  useEffect(() => {
    setLocal(buildLocalState(data?.map ?? {}));
  }, [data]);

  // 預覽：套用本地未存的變更
  const previewMap = useMemo<PlatformMenuOverrideMap>(() => {
    const result: PlatformMenuOverrideMap = {};
    for (const path in local) {
      const l = local[path];
      result[path] = {
        visible: l.visible,
        customLabel: l.customLabel || null,
        sortOrder: l.sortOrder,
        customGroup: l.customGroup || null,
      };
    }
    return result;
  }, [local]);

  const previewGroups = useMemo(
    () => applyMenuOverrides(PLATFORM_MENU_GROUPS, previewMap),
    [previewMap],
  );

  const dirtyPaths = useMemo(() => {
    const r = data?.map ?? {};
    return Object.keys(local).filter((path) => isDirty(local[path], r[path]));
  }, [local, data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const remote = data?.map ?? {};
      const updates = dirtyPaths.map((path) => {
        const l = local[path];
        const isDefault =
          l.visible === true &&
          !l.customLabel &&
          l.sortOrder === 0 &&
          !l.customGroup;
        // 完全恢復預設 + 遠端有資料 → 刪除 override
        if (isDefault && remote[path]) {
          return { path, action: "delete" as const };
        }
        return {
          path,
          action: "upsert" as const,
          payload: {
            menuPath: path,
            visible: l.visible,
            customLabel: l.customLabel || null,
            sortOrder: l.sortOrder,
            customGroup: l.customGroup || null,
          },
        };
      });

      for (const update of updates) {
        if (update.action === "delete") {
          await apiRequest(
            "DELETE",
            `/api/platform/menu-overrides?menuPath=${encodeURIComponent(update.path)}`,
          );
        } else {
          await apiRequest("POST", "/api/platform/menu-overrides", update.payload);
        }
      }
      return updates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/menu-overrides"] });
      toast({ title: `✅ 已儲存 ${count} 個變更` });
    },
    onError: (err) => {
      toast({
        title: "儲存失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  const resetItem = (path: string) => {
    setLocal((prev) => ({
      ...prev,
      [path]: {
        visible: true,
        customLabel: "",
        sortOrder: 0,
        customGroup: "",
      },
    }));
  };

  const resetAll = () => {
    setLocal(buildLocalState({}));
  };

  const updateField = <K extends keyof LocalOverride>(
    path: string,
    field: K,
    value: LocalOverride[K],
  ) => {
    setLocal((prev) => ({
      ...prev,
      [path]: { ...prev[path], [field]: value },
    }));
  };

  if (isLoading) {
    return (
      <PlatformAdminLayout title="選單管理">
        <div className="p-4 sm:p-6 max-w-6xl mx-auto">
          <ListSkeleton count={5} />
        </div>
      </PlatformAdminLayout>
    );
  }

  const hiddenCount = Object.values(local).filter((l) => !l.visible).length;
  const totalCount = Object.keys(local).length;

  return (
    <PlatformAdminLayout
      title="選單管理"
      actions={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:inline-flex">
            <ListTree className="w-3 h-3 mr-1" />
            {totalCount} 項目
          </Badge>
          <Badge variant="secondary" className="hidden sm:inline-flex">
            <EyeOff className="w-3 h-3 mr-1" />
            {hiddenCount} 隱藏
          </Badge>
        </div>
      }
    >
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-4">
        {/* 操作列 */}
        <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-medium">控制 sidebar 選單顯示與排序</p>
              <p className="text-xs text-muted-foreground mt-1">
                修改後按右側「儲存變更」即時生效。完全恢復預設值會刪除 override 紀錄。
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={resetAll}
                disabled={dirtyPaths.length === 0}
                data-testid="button-reset-all"
              >
                <RotateCcw className="w-4 h-4 mr-1" />
                恢復預設
              </Button>
              <Button
                size="sm"
                onClick={() => saveMutation.mutate()}
                disabled={dirtyPaths.length === 0 || saveMutation.isPending}
                data-testid="button-save"
              >
                <Save className="w-4 h-4 mr-1" />
                {saveMutation.isPending ? "儲存中…" : `儲存 (${dirtyPaths.length})`}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 編輯區：依分組列出 */}
        <div className="space-y-4">
          {PLATFORM_MENU_GROUPS.map((group) => (
            <Card key={group.label}>
              <CardContent className="p-0">
                <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  <span className="text-xs text-muted-foreground">{group.items.length} 項</span>
                </div>

                <div className="divide-y">
                  {group.items.map((item) => {
                    const l = local[item.path];
                    if (!l) return null;
                    const Icon = item.icon;
                    const dirty = isDirty(l, data?.map?.[item.path]);
                    return (
                      <div
                        key={item.path}
                        className={`px-4 py-3 ${
                          !l.visible ? "bg-muted/20 opacity-60" : ""
                        } ${dirty ? "border-l-2 border-l-amber-500" : ""}`}
                      >
                        <div className="grid grid-cols-12 gap-3 items-center">
                          {/* Icon + path */}
                          <div className="col-span-12 sm:col-span-3 flex items-center gap-2 min-w-0">
                            <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <Icon className="w-4 h-4 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{item.label}</p>
                              <p className="text-[11px] text-muted-foreground truncate font-mono">
                                {item.path}
                              </p>
                            </div>
                          </div>

                          {/* customLabel */}
                          <div className="col-span-6 sm:col-span-3">
                            <Input
                              placeholder="自訂顯示名稱（選填）"
                              value={l.customLabel}
                              onChange={(e) =>
                                updateField(item.path, "customLabel", e.target.value)
                              }
                              className="h-8 text-sm"
                              data-testid={`input-label-${item.path}`}
                            />
                          </div>

                          {/* sortOrder */}
                          <div className="col-span-3 sm:col-span-2">
                            <Input
                              type="number"
                              placeholder="排序"
                              value={l.sortOrder}
                              onChange={(e) =>
                                updateField(
                                  item.path,
                                  "sortOrder",
                                  parseInt(e.target.value || "0", 10) || 0,
                                )
                              }
                              className="h-8 text-sm tabular-nums"
                              data-testid={`input-order-${item.path}`}
                            />
                          </div>

                          {/* customGroup */}
                          <div className="col-span-9 sm:col-span-2">
                            <Input
                              placeholder="自訂分組（選填）"
                              value={l.customGroup}
                              onChange={(e) =>
                                updateField(item.path, "customGroup", e.target.value)
                              }
                              className="h-8 text-sm"
                              data-testid={`input-group-${item.path}`}
                            />
                          </div>

                          {/* visible toggle + reset */}
                          <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-2">
                            <div className="flex items-center gap-1.5">
                              <Switch
                                checked={l.visible}
                                onCheckedChange={(v) => updateField(item.path, "visible", v)}
                                data-testid={`switch-visible-${item.path}`}
                              />
                              <Label className="text-xs">
                                {l.visible ? (
                                  <Eye className="w-3.5 h-3.5 text-green-600" />
                                ) : (
                                  <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                                )}
                              </Label>
                            </div>
                            {dirty && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => resetItem(item.path)}
                                className="h-7 px-2"
                                title="恢復此項預設"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 預覽區 */}
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4" />
                預覽
              </h3>
              <span className="text-xs text-muted-foreground">套用後的 sidebar 結構</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {previewGroups.map((g) => (
                <div key={g.label} className="border rounded-md p-3 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">{g.label}</p>
                  <ul className="space-y-1">
                    {g.items.map((it) => {
                      const Icon = it.icon;
                      return (
                        <li key={it.path} className="text-sm flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{it.label}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </PlatformAdminLayout>
  );
}
