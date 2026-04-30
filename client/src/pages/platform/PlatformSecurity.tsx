// 🛡️ 平台安全儀表板（B 區塊）
//
// Sections：
//   1. 安全總覽 — 24h/7d 失敗數、鎖定帳號、風險 IP
//   2. 風險 IP — 24h 失敗 ≥10 次的 IP
//   3. 鎖定帳號 — 列表 + 手動解鎖
//   4. 登入失敗記錄 — 最近 200 筆
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Shield,
  ShieldAlert,
  Lock,
  Unlock,
  Activity,
  AlertTriangle,
  Building2,
  User,
  Globe,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SecurityOverview {
  failures_24h: number;
  failures_7d: number;
  locked_accounts: number;
  risky_ips: number;
  unique_failed_users_24h: number;
}

interface LoginFailureLog {
  id: string;
  action: string;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  admin: {
    id: string;
    username: string;
    displayName: string | null;
    status: string;
    fieldId: string | null;
    failedLoginAttempts: number | null;
  } | null;
}

interface RiskyIp {
  ip_address: string;
  attempts: number;
  unique_users: number;
  last_attempt: string;
}

interface LockedAccount {
  id: string;
  username: string;
  displayName: string | null;
  email: string | null;
  fieldId: string | null;
  failedLoginAttempts: number | null;
  updatedAt: string;
  field: { id: string; name: string; code: string } | null;
  role: { id: string; name: string; systemRole: string } | null;
}

export default function PlatformSecurity() {
  const { isAuthenticated } = useAdminAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [unlockTarget, setUnlockTarget] = useState<LockedAccount | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const [ipFilter, setIpFilter] = useState("");

  const { data: overview } = useQuery<SecurityOverview>({
    queryKey: ["/api/platform/security/overview"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/security/overview")).json(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: failures } = useQuery<{ items: LoginFailureLog[]; total: number }>({
    queryKey: ["/api/platform/security/login-failures", ipFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (ipFilter) params.set("ip", ipFilter);
      const url = `/api/platform/security/login-failures?${params.toString()}`;
      return (await apiRequest("GET", url)).json();
    },
    enabled: isAuthenticated,
  });

  const { data: riskyIps } = useQuery<{ items: RiskyIp[]; threshold: number }>({
    queryKey: ["/api/platform/security/risky-ips"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/security/risky-ips")).json(),
    enabled: isAuthenticated,
  });

  const { data: locked } = useQuery<{ items: LockedAccount[]; total: number }>({
    queryKey: ["/api/platform/security/locked-accounts"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/security/locked-accounts")).json(),
    enabled: isAuthenticated,
  });

  const unlockMutation = useMutation({
    mutationFn: async () => {
      if (!unlockTarget) return;
      const res = await apiRequest("POST", "/api/platform/security/unlock-account", {
        accountId: unlockTarget.id,
        reason: unlockReason || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/platform/security/locked-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/platform/security/overview"] });
      setUnlockTarget(null);
      setUnlockReason("");
      toast({ title: "✅ 帳號已解鎖" });
    },
    onError: (err) => {
      toast({
        title: "解鎖失敗",
        description: err instanceof Error ? err.message : "請稍後再試",
        variant: "destructive",
      });
    },
  });

  return (
    <PlatformAdminLayout title="安全機制">
      {/* 總覽 5 卡 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <KpiCard
          label="24h 失敗"
          value={overview?.failures_24h ?? 0}
          accent={overview && overview.failures_24h >= 50 ? "text-destructive" : "text-amber-500"}
          icon={<Activity className="w-4 h-4" />}
        />
        <KpiCard
          label="7天失敗"
          value={overview?.failures_7d ?? 0}
          accent="text-blue-500"
          icon={<Activity className="w-4 h-4" />}
        />
        <KpiCard
          label="鎖定帳號"
          value={overview?.locked_accounts ?? 0}
          accent={overview && overview.locked_accounts > 0 ? "text-destructive" : "text-emerald-500"}
          icon={<Lock className="w-4 h-4" />}
        />
        <KpiCard
          label="風險 IP"
          value={overview?.risky_ips ?? 0}
          accent={overview && overview.risky_ips > 0 ? "text-destructive" : "text-emerald-500"}
          icon={<Globe className="w-4 h-4" />}
        />
        <KpiCard
          label="24h 受害帳號"
          value={overview?.unique_failed_users_24h ?? 0}
          accent="text-amber-500"
          icon={<User className="w-4 h-4" />}
        />
      </div>

      {/* 風險 IP */}
      {riskyIps?.items.length ? (
        <Card className="mb-6 border-l-4 border-l-destructive">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <ShieldAlert className="w-4 h-4 text-destructive" />
              風險 IP（24 小時內失敗 ≥{riskyIps.threshold} 次）
            </h3>
            <div className="space-y-1">
              {riskyIps.items.map((ip) => (
                <div
                  key={ip.ip_address}
                  className="flex items-center gap-3 py-2 px-3 bg-destructive/5 rounded text-sm"
                >
                  <Globe className="w-4 h-4 text-destructive" />
                  <span className="font-mono">{ip.ip_address}</span>
                  <Badge variant="destructive" className="tabular-nums">
                    {ip.attempts} 次失敗
                  </Badge>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {ip.unique_users} 個帳號 · 最後 {new Date(ip.last_attempt).toLocaleString("zh-TW")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={() => setIpFilter(ip.ip_address)}
                  >
                    查看記錄
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* 鎖定帳號 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
            <Lock className="w-4 h-4" />
            鎖定帳號（需 platform admin 解鎖）
          </h3>
          {locked?.items.length ? (
            <div className="space-y-2">
              {locked.items.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center gap-3 p-3 border rounded hover:bg-accent/30"
                >
                  <Lock className="w-4 h-4 text-destructive shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {acc.displayName || acc.username}
                      </span>
                      <span className="text-xs text-muted-foreground">@{acc.username}</span>
                      {acc.field && (
                        <Badge variant="outline" className="text-[10px]">
                          <Building2 className="w-3 h-3 mr-1" />
                          {acc.field.code}
                        </Badge>
                      )}
                      {acc.role && (
                        <Badge variant="secondary" className="text-[10px]">{acc.role.name}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                      失敗 {acc.failedLoginAttempts ?? 0} 次 · 鎖定於 {new Date(acc.updatedAt).toLocaleString("zh-TW")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setUnlockTarget(acc)}
                    className="gap-1"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    解鎖
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">🎉 目前無鎖定帳號</p>
          )}
        </CardContent>
      </Card>

      {/* 登入失敗記錄 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              登入失敗記錄（最近 200 筆）
            </h3>
            <div className="flex items-center gap-2">
              <Input
                placeholder="篩 IP..."
                value={ipFilter}
                onChange={(e) => setIpFilter(e.target.value)}
                className="w-40 h-8 text-xs"
              />
              {ipFilter && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIpFilter("")}
                  className="h-8 px-2"
                >
                  清除
                </Button>
              )}
            </div>
          </div>
          {failures?.items.length ? (
            <div className="space-y-1 max-h-96 overflow-y-auto">
              {failures.items.map((f) => {
                const meta = (f.metadata || {}) as Record<string, unknown>;
                const username = (meta.username as string) || f.admin?.username || "-";
                const attempts = (meta.attempts as number) || 0;
                const isLocked = f.action === "auth:login_locked";
                return (
                  <div
                    key={f.id}
                    className={`flex items-center gap-2 px-2 py-1.5 text-xs rounded ${
                      isLocked ? "bg-destructive/10" : "hover:bg-accent/30"
                    }`}
                  >
                    <Badge
                      variant={isLocked ? "destructive" : "outline"}
                      className="text-[10px] shrink-0"
                    >
                      {isLocked ? "鎖定" : "失敗"}
                    </Badge>
                    <span className="font-mono shrink-0">{username}</span>
                    {attempts > 0 && (
                      <span className="text-muted-foreground tabular-nums shrink-0">
                        ({attempts} 次)
                      </span>
                    )}
                    {f.ipAddress && (
                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                        {f.ipAddress}
                      </Badge>
                    )}
                    <span className="ml-auto text-muted-foreground tabular-nums shrink-0">
                      {new Date(f.createdAt).toLocaleString("zh-TW", {
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">尚無登入失敗紀錄</p>
          )}
        </CardContent>
      </Card>

      {/* 解鎖確認 dialog */}
      <AlertDialog open={!!unlockTarget} onOpenChange={(open) => !open && setUnlockTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlock className="w-5 h-5 text-emerald-500" />
              解鎖帳號
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {unlockTarget && (
                  <div className="bg-muted/30 rounded p-2 text-sm">
                    <div className="font-medium">
                      {unlockTarget.displayName || unlockTarget.username}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      @{unlockTarget.username}
                      {unlockTarget.field && ` · ${unlockTarget.field.code}`}
                      {" · 失敗 "}{unlockTarget.failedLoginAttempts}{" 次"}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground">解鎖原因（選填，會記入稽核）</label>
                  <Input
                    placeholder="例：誤鎖、確認帳號擁有者身分"
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <p className="text-xs text-amber-600">
                  ⚠️ 解鎖會 reset 失敗次數並設回 active，建議確認帳號擁有者身分
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlockMutation.mutate()}
              disabled={unlockMutation.isPending}
            >
              {unlockMutation.isPending ? "解鎖中..." : "確認解鎖"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlatformAdminLayout>
  );
}

function KpiCard({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: number;
  accent: string;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
