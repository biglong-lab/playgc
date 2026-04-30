// 🌐 平台跨場域角色與權限管理（含編輯器 — 2026-04-30）
//
// 功能：
//   - super_admin 看所有場域的角色定義
//   - 點「編輯」開抽屜：分組 checkbox 編輯權限
//   - 即時 PATCH 並 audit log
//
// 後端：/api/platform/roles + /api/platform/permissions + PATCH /api/platform/roles/:id
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Shield, Search, Building2, ChevronRight, Key, Pencil, Save, X as XIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  systemRole: string;
  fieldId: string | null;
  createdAt: string | null;
  permissions: string[];
  field: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface RolesListResponse {
  roles: RoleRow[];
  total: number;
}

interface PermissionDef {
  id: string;
  key: string;
  category: string;
  description: string | null;
}

interface PermissionsListResponse {
  permissions: PermissionDef[];
  total: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  game: "遊戲管理",
  user: "使用者管理",
  admin: "管理員操作",
  field: "場域管理",
  system: "系統設定",
  device: "裝置管理",
  session: "場次管理",
  analytics: "數據分析",
};

export default function PlatformRoles() {
  const { isAuthenticated } = useAdminAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [systemRoleFilter, setSystemRoleFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);

  const { data, isLoading } = useQuery<RolesListResponse>({
    queryKey: ["/api/platform/roles"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/roles");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const roles = data?.roles ?? [];

  // 唯一場域列表
  const fieldOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    roles.forEach((r) => {
      if (r.field) map.set(r.field.id, r.field);
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [roles]);

  const systemRoleOptions = useMemo(() => {
    const set = new Set<string>();
    roles.forEach((r) => set.add(r.systemRole));
    return Array.from(set).sort();
  }, [roles]);

  const filtered = useMemo(() => {
    return roles.filter((r) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          r.name.toLowerCase().includes(q) ||
          (r.description || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (systemRoleFilter !== "all" && r.systemRole !== systemRoleFilter) return false;
      if (fieldFilter !== "all" && r.fieldId !== fieldFilter) return false;
      return true;
    });
  }, [roles, searchQuery, systemRoleFilter, fieldFilter]);

  const stats = useMemo(() => {
    return {
      total: roles.length,
      systemRoles: systemRoleOptions.length,
      fields: fieldOptions.length,
      avgPerms: roles.length > 0
        ? Math.round(roles.reduce((sum, r) => sum + r.permissions.length, 0) / roles.length)
        : 0,
    };
  }, [roles, systemRoleOptions.length, fieldOptions.length]);

  const getSystemRoleBadge = (sr: string) => {
    const map: Record<string, string> = {
      super_admin: "bg-amber-500",
      field_admin: "bg-blue-500",
      field_editor: "bg-emerald-500",
      field_viewer: "bg-muted-foreground",
      custom: "bg-purple-500",
    };
    return (
      <Badge className={`${map[sr] || "bg-muted"} text-white`}>
        {sr}
      </Badge>
    );
  };

  return (
    <PlatformAdminLayout title="跨場域角色與權限">
      {/* 統計 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="總角色數" value={stats.total} accent="text-primary" />
        <StatCard label="系統角色類型" value={stats.systemRoles} accent="text-amber-500" />
        <StatCard label="場域數" value={stats.fields} accent="text-blue-500" />
        <StatCard label="平均權限數" value={stats.avgPerms} accent="text-emerald-500" />
      </div>

      {/* 篩選列 */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋角色名稱 / 描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-platform-roles"
          />
        </div>
        <Select value={systemRoleFilter} onValueChange={setSystemRoleFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="系統角色" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部系統角色</SelectItem>
            {systemRoleOptions.map((sr) => (
              <SelectItem key={sr} value={sr}>
                {sr}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fieldFilter} onValueChange={setFieldFilter}>
          <SelectTrigger className="w-full md:w-44">
            <SelectValue placeholder="場域" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部場域</SelectItem>
            {fieldOptions.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}（{f.code}）
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {isLoading ? (
        <ListSkeleton count={5} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={roles.length === 0 ? "尚無角色" : "沒有符合條件的角色"}
          description={roles.length === 0 ? "尚未有任何場域建立角色" : "試著清除篩選條件"}
        />
      ) : (
        <div className="space-y-2" data-testid="platform-roles-list">
          {filtered.map((r) => (
            <RoleCard
              key={r.id}
              role={r}
              systemRoleBadge={getSystemRoleBadge(r.systemRole)}
              onEdit={() => setEditingRole(r)}
            />
          ))}
        </div>
      )}

      {/* 角色編輯抽屜 */}
      {editingRole && (
        <RoleEditorSheet
          role={editingRole}
          onClose={() => setEditingRole(null)}
        />
      )}
    </PlatformAdminLayout>
  );
}

// ============================================================================
// 🆕 角色編輯抽屜 — 分組 checkbox 編輯權限
// ============================================================================
function RoleEditorSheet({
  role,
  onClose,
}: {
  role: RoleRow;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");

  const { data: permsData, isLoading: permsLoading } = useQuery<PermissionsListResponse>({
    queryKey: ["/api/platform/permissions"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/permissions")).json(),
  });

  const allPerms = permsData?.permissions ?? [];

  // 用 permission key（API 回傳的 role.permissions）反推目前選了哪些 ID
  const initialSelected = useMemo(() => {
    const set = new Set<string>();
    allPerms.forEach((p) => {
      if (role.permissions.includes(p.key)) set.add(p.id);
    });
    return set;
  }, [allPerms, role.permissions]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(initialSelected);

  // permsData 載入後初始化（async case）
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    if (allPerms.length > 0 && selectedIds.size === 0 && initialSelected.size > 0) {
      setSelectedIds(initialSelected);
    }
  }, [allPerms.length]);

  // 按 category 分組
  const groupedPerms = useMemo(() => {
    const map = new Map<string, PermissionDef[]>();
    allPerms.forEach((p) => {
      const cat = p.category || "other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [allPerms]);

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleCategory = (categoryPerms: PermissionDef[]) => {
    const ids = categoryPerms.map((p) => p.id);
    const allSelected = ids.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSelected) {
      ids.forEach((id) => next.delete(id));
    } else {
      ids.forEach((id) => next.add(id));
    }
    setSelectedIds(next);
  };

  const isSuperAdmin = role.systemRole === "super_admin";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (name !== role.name) body.name = name;
      if (description !== (role.description ?? "")) body.description = description;
      body.permissionIds = Array.from(selectedIds);
      const res = await apiRequest("PATCH", `/api/platform/roles/${role.id}`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/roles"] });
      toast({ title: "✅ 角色已更新", description: `${name} · ${selectedIds.size} 個權限` });
      onClose();
    },
    onError: (err) => {
      toast({
        title: "更新失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  return (
    <Sheet open={true} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5" />
            編輯角色
          </SheetTitle>
          <SheetDescription>
            {role.field ? `${role.field.name}（${role.field.code}）` : "全平台共用"}
            {" · "}
            <span className="font-mono text-xs">{role.systemRole}</span>
          </SheetDescription>
        </SheetHeader>

        {isSuperAdmin && (
          <div className="mt-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-500/40 rounded p-3 text-sm">
            <p className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <XIcon className="w-4 h-4" />
              super_admin 系統角色不可修改
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              super_admin 在程式邏輯中自動 bypass 全部權限，無需在此設定。
            </p>
          </div>
        )}

        {/* 名稱 / 描述 */}
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs text-muted-foreground">角色名稱</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSuperAdmin}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">描述（選填）</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSuperAdmin}
              className="mt-1"
              placeholder="例：負責編輯遊戲內容的角色"
            />
          </div>
        </div>

        {/* 權限分組 */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-muted-foreground">
              權限（已選 {selectedIds.size} / {allPerms.length}）
            </label>
            {!isSuperAdmin && (
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set(allPerms.map((p) => p.id)))}
                  className="text-xs h-7"
                >
                  全選
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs h-7"
                >
                  全不選
                </Button>
              </div>
            )}
          </div>

          {permsLoading ? (
            <ListSkeleton count={3} />
          ) : (
            <div className="space-y-2">
              {groupedPerms.map(([category, perms]) => {
                const allSelected = perms.every((p) => selectedIds.has(p.id));
                const someSelected = perms.some((p) => selectedIds.has(p.id));
                return (
                  <Card key={category} className="border-l-4 border-l-primary/40">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={() => toggleCategory(perms)}
                          disabled={isSuperAdmin}
                          // @ts-expect-error checkbox 接受 indeterminate 但 type 不認
                          indeterminate={someSelected && !allSelected}
                        />
                        <span className="font-semibold text-sm">
                          {CATEGORY_LABELS[category] || category}
                        </span>
                        <Badge variant="outline" className="text-[10px] tabular-nums">
                          {perms.filter((p) => selectedIds.has(p.id)).length} / {perms.length}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-6">
                        {perms.map((p) => (
                          <label
                            key={p.id}
                            className={`flex items-start gap-2 p-1.5 rounded text-xs cursor-pointer hover:bg-accent/30 ${
                              isSuperAdmin ? "opacity-50 cursor-not-allowed" : ""
                            }`}
                          >
                            <Checkbox
                              checked={selectedIds.has(p.id)}
                              onCheckedChange={() => toggleOne(p.id)}
                              disabled={isSuperAdmin}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-mono">{p.key}</div>
                              {p.description && (
                                <div className="text-muted-foreground text-[10px] truncate">
                                  {p.description}
                                </div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <SheetFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={isSuperAdmin || saveMutation.isPending}
            className="gap-1"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "儲存中..." : "儲存"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function RoleCard({
  role,
  systemRoleBadge,
  onEdit,
}: {
  role: RoleRow;
  systemRoleBadge: React.ReactNode;
  onEdit: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isSuperAdmin = role.systemRole === "super_admin";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <div className="flex items-center">
          <CollapsibleTrigger className="flex-1 text-left">
            <CardContent className="p-4 flex items-center gap-3 hover:bg-accent/30 transition-colors rounded-lg">
              <ChevronRight
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{role.name}</span>
                  {systemRoleBadge}
                  <Badge variant="outline" className="tabular-nums">
                    <Key className="w-3 h-3 mr-1" />
                    {role.permissions.length} 權限
                  </Badge>
                </div>
                {role.description && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    {role.description}
                  </p>
                )}
                <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                  <Building2 className="w-3 h-3" />
                  {role.field?.name ?? "全平台共用"}
                  {role.field && (
                    <span className="text-muted-foreground/60">（{role.field.code}）</span>
                  )}
                </div>
              </div>
            </CardContent>
          </CollapsibleTrigger>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            disabled={isSuperAdmin}
            className="mr-3 gap-1"
            title={isSuperAdmin ? "super_admin 系統角色不可修改" : "編輯角色"}
          >
            <Pencil className="w-3.5 h-3.5" />
            編輯
          </Button>
        </div>
        <CollapsibleContent>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-xs text-muted-foreground mb-2">權限列表：</div>
            {role.permissions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                此角色沒有任何權限
                {role.systemRole === "super_admin" && "（但 super_admin 在程式邏輯中自動 bypass 全部）"}
              </p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {role.permissions.map((perm) => (
                  <Badge key={perm} variant="secondary" className="text-xs font-mono">
                    {perm}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
