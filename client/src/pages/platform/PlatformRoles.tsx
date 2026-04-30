// 🌐 平台跨場域角色與權限管理
//
// 功能：super_admin 可看到所有場域的角色定義（含 permissions 列表）
// 用途：稽核 / 比較不同場域的權限配置 / 確認角色設定一致性
//
// 後端：/api/platform/roles + /api/platform/permissions
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Shield, Search, Building2, ChevronRight, Key } from "lucide-react";

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

export default function PlatformRoles() {
  const { isAuthenticated } = useAdminAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [systemRoleFilter, setSystemRoleFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

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
            <RoleCard key={r.id} role={r} systemRoleBadge={getSystemRoleBadge(r.systemRole)} />
          ))}
        </div>
      )}
    </PlatformAdminLayout>
  );
}

function RoleCard({
  role,
  systemRoleBadge,
}: {
  role: RoleRow;
  systemRoleBadge: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="w-full text-left">
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
