// 🔐 權限管理矩陣（2026-06-22）
// 路徑：/admin/permission-matrix
// 角色 × 權限 一覽矩陣，點格即時開關（複用 GET /api/admin/roles|permissions + PATCH role）。
// super_admin 自動擁有全部權限（欄位顯示為唯讀全開）。

import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { useToast } from "@/hooks/use-toast";
import { useAdminAuth } from "@/hooks/useAdminAuth";

interface Permission { id: string; key: string; name: string; category: string }
interface Role {
  id: string;
  name: string;
  systemRole: string;
  rolePermissions: Array<{ permissionId: string }>;
}

const CAT_LABEL: Record<string, string> = {
  game: "遊戲", content: "內容", qr: "QR", field: "場域", user: "使用者",
  admin: "管理", pos: "POS 現金", session: "場次", device: "裝置", analytics: "分析", system: "系統",
};

export default function PermissionMatrix() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission } = useAdminAuth({ redirectTo: "" });
  const canManage = hasPermission("user:manage_roles");

  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: () => fetchWithAdminAuth("/api/admin/roles"),
    enabled: canManage,
  });
  const { data: permissions } = useQuery<Permission[]>({
    queryKey: ["/api/admin/permissions"],
    queryFn: () => fetchWithAdminAuth("/api/admin/permissions"),
    enabled: canManage,
  });

  const patchRole = useMutation({
    mutationFn: (v: { roleId: string; permissionIds: string[] }) =>
      fetchWithAdminAuth(`/api/admin/roles/${v.roleId}`, {
        method: "PATCH",
        body: JSON.stringify({ permissionIds: v.permissionIds }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/roles"] });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "更新失敗", description: e.message }),
  });

  const grouped = useMemo(() => {
    const g: Record<string, Permission[]> = {};
    for (const p of permissions ?? []) (g[p.category] ??= []).push(p);
    return g;
  }, [permissions]);

  // 一般角色（super_admin 欄位特殊處理：全開唯讀）
  const editableRoles = (roles ?? []).filter((r) => r.systemRole !== "super_admin");
  const superRoles = (roles ?? []).filter((r) => r.systemRole === "super_admin");

  function roleHas(role: Role, permId: string) {
    return role.rolePermissions.some((rp) => rp.permissionId === permId);
  }
  function toggle(role: Role, permId: string) {
    const cur = role.rolePermissions.map((rp) => rp.permissionId);
    const next = cur.includes(permId) ? cur.filter((x) => x !== permId) : [...cur, permId];
    patchRole.mutate({ roleId: role.id, permissionIds: next });
  }

  if (!canManage) {
    return (
      <div className="min-h-screen flex items-center justify-center text-center p-8 text-muted-foreground">
        <div>
          <p className="text-base font-medium">🔒 權限不足</p>
          <p className="text-sm mt-2">權限矩陣僅限可管理角色者（user:manage_roles）使用。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/admin"><button className="text-sm text-muted-foreground p-1">← 後台</button></Link>
          <h1 className="font-bold text-xl flex-1">🔐 權限管理矩陣</h1>
          <Link href="/admin/roles"><button className="text-sm text-primary">逐一編輯角色 →</button></Link>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          點格即時開關該角色的權限。super_admin 自動擁有全部權限（唯讀）。
        </p>

        <div className="overflow-x-auto rounded-xl border bg-white dark:bg-slate-900">
          <table className="text-sm border-collapse min-w-max">
            <thead>
              <tr className="border-b">
                <th className="sticky left-0 z-10 bg-white dark:bg-slate-900 text-left px-3 py-2 font-semibold min-w-[180px]">權限</th>
                {editableRoles.map((r) => (
                  <th key={r.id} className="px-3 py-2 font-medium text-center whitespace-nowrap min-w-[90px]">{r.name}</th>
                ))}
                {superRoles.map((r) => (
                  <th key={r.id} className="px-3 py-2 font-medium text-center text-amber-600 whitespace-nowrap min-w-[90px]">{r.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([cat, perms]) => (
                <PermGroup
                  key={cat}
                  label={CAT_LABEL[cat] ?? cat}
                  perms={perms}
                  editableRoles={editableRoles}
                  superCount={superRoles.length}
                  roleHas={roleHas}
                  toggle={toggle}
                  pending={patchRole.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PermGroup({
  label, perms, editableRoles, superCount, roleHas, toggle, pending,
}: {
  label: string;
  perms: Permission[];
  editableRoles: Role[];
  superCount: number;
  roleHas: (r: Role, id: string) => boolean;
  toggle: (r: Role, id: string) => void;
  pending: boolean;
}) {
  return (
    <>
      <tr className="bg-muted/50">
        <td colSpan={1 + editableRoles.length + superCount} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          {label}
        </td>
      </tr>
      {perms.map((p) => (
        <tr key={p.id} className="border-b hover:bg-muted/30">
          <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2">
            <div className="font-medium">{p.name}</div>
            <div className="text-xs text-muted-foreground">{p.key}</div>
          </td>
          {editableRoles.map((r) => (
            <td key={r.id} className="text-center px-3 py-2">
              <button
                onClick={() => !pending && toggle(r, p.id)}
                disabled={pending}
                data-testid={`matrix-cell-${r.id}-${p.key}`}
                className={`w-6 h-6 rounded border-2 transition-colors ${
                  roleHas(r, p.id)
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "bg-transparent border-muted-foreground/30 hover:border-emerald-400"
                }`}
                aria-label={`${r.name} ${p.name}`}
              >
                {roleHas(r, p.id) ? "✓" : ""}
              </button>
            </td>
          ))}
          {Array.from({ length: superCount }).map((_, i) => (
            <td key={i} className="text-center px-3 py-2 text-amber-500">✓</td>
          ))}
        </tr>
      ))}
    </>
  );
}
