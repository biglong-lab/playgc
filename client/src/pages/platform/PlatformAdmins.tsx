// 🌐 平台跨場域管理員管理
//
// 功能：super_admin 在此可看到所有場域的 admin 帳號，並可：
//   - 篩選場域 / 狀態
//   - 直接切換 status（active / inactive / locked）
//   - 不必逐場域切換 — 一頁總覽
//
// 後端：/api/platform/admins (GET 列表 / PATCH /:id)
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Users, Search, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AdminRow {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  fieldId: string;
  status: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  role: {
    id: string;
    name: string;
    systemRole: string;
  } | null;
  field: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface AdminListResponse {
  accounts: AdminRow[];
  total: number;
}

export default function PlatformAdmins() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fieldFilter, setFieldFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<AdminListResponse>({
    queryKey: ["/api/platform/admins"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/platform/admins");
      return res.json();
    },
    enabled: isAuthenticated,
  });

  const accounts = data?.accounts ?? [];

  // 從 accounts 抽出唯一場域列表（給 filter 用）
  const fieldOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    accounts.forEach((acc) => {
      if (acc.field) {
        map.set(acc.field.id, acc.field);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [accounts]);

  // 篩選後的列表
  const filtered = useMemo(() => {
    return accounts.filter((acc) => {
      // 搜尋 username / displayName / email
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matches =
          acc.username.toLowerCase().includes(q) ||
          (acc.displayName || "").toLowerCase().includes(q) ||
          (acc.email || "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (statusFilter !== "all" && acc.status !== statusFilter) return false;
      if (fieldFilter !== "all" && acc.fieldId !== fieldFilter) return false;
      return true;
    });
  }, [accounts, searchQuery, statusFilter, fieldFilter]);

  // 更新狀態 mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await apiRequest("PATCH", `/api/platform/admins/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/admins"] });
      toast({ title: "✅ 已更新", description: "管理員狀態已變更" });
    },
    onError: (err) => {
      toast({
        title: "更新失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  // 統計數據
  const stats = useMemo(() => {
    return {
      total: accounts.length,
      active: accounts.filter((a) => a.status === "active").length,
      locked: accounts.filter((a) => a.status === "locked").length,
      inactive: accounts.filter((a) => a.status === "inactive").length,
      fields: fieldOptions.length,
    };
  }, [accounts, fieldOptions.length]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "destructive" | "secondary" | "outline"; label: string }> = {
      active: { variant: "default", label: "啟用" },
      inactive: { variant: "secondary", label: "停用" },
      locked: { variant: "destructive", label: "鎖定" },
    };
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <PlatformAdminLayout title="跨場域管理員">
      {/* 統計卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <StatCard label="總帳號" value={stats.total} accent="text-primary" />
        <StatCard label="啟用中" value={stats.active} accent="text-emerald-500" />
        <StatCard label="鎖定" value={stats.locked} accent="text-destructive" />
        <StatCard label="停用" value={stats.inactive} accent="text-muted-foreground" />
        <StatCard label="場域數" value={stats.fields} accent="text-blue-500" icon={<Building2 className="w-4 h-4" />} />
      </div>

      {/* 篩選列 */}
      <div className="flex flex-col md:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜尋帳號 / 名稱 / Email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-platform-admins"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-32">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="active">啟用</SelectItem>
            <SelectItem value="inactive">停用</SelectItem>
            <SelectItem value="locked">鎖定</SelectItem>
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
          icon={Users}
          title={accounts.length === 0 ? "尚無管理員" : "沒有符合條件的管理員"}
          description={accounts.length === 0 ? "尚未有任何場域建立 admin 帳號" : "試著清除篩選條件"}
        />
      ) : (
        <div className="space-y-2" data-testid="platform-admins-list">
          {filtered.map((acc) => (
            <Card key={acc.id} className="hover-elevate">
              <CardContent className="p-4 flex flex-col md:flex-row md:items-center gap-3">
                {/* 主要資訊 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{acc.displayName || acc.username}</span>
                    <span className="text-sm text-muted-foreground">@{acc.username}</span>
                    {getStatusBadge(acc.status)}
                    {acc.role?.systemRole === "super_admin" && (
                      <Badge variant="default" className="bg-amber-500">超級管理員</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />
                      {acc.field?.name ?? "未知場域"}（{acc.field?.code ?? "-"}）
                    </span>
                    {acc.role && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span>角色：{acc.role.name}</span>
                      </>
                    )}
                    {acc.email && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span>{acc.email}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* 狀態切換 */}
                <Select
                  value={acc.status}
                  onValueChange={(newStatus) => updateMutation.mutate({ id: acc.id, status: newStatus })}
                  disabled={updateMutation.isPending}
                >
                  <SelectTrigger className="w-full md:w-32" data-testid={`select-status-${acc.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">啟用</SelectItem>
                    <SelectItem value="inactive">停用</SelectItem>
                    <SelectItem value="locked">鎖定</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PlatformAdminLayout>
  );
}

function StatCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
