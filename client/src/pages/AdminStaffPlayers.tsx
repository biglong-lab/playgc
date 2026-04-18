// 🎫 玩家管理 — 本場域玩家清單 + 管理員授權開關
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Shield, ShieldOff, Ban, CheckCircle2, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "./admin-staff/types";
import { apiRequest } from "@/lib/queryClient";

interface MemberRow {
  membership: {
    id: string;
    userId: string;
    fieldId: string;
    joinedAt: string;
    isAdmin: boolean;
    adminRoleId: string | null;
    playerStatus: string;
  };
  user: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  } | null;
  role: {
    id: string;
    name: string;
  } | null;
}

interface Role {
  id: string;
  name: string;
  systemRole: string | null;
  fieldId: string | null;
}

function formatDate(dateString: string | null) {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function getInitials(user: MemberRow["user"]) {
  if (!user) return "?";
  if (user.firstName && user.lastName)
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
  if (user.firstName) return user.firstName[0].toUpperCase();
  if (user.email) return user.email[0].toUpperCase();
  return "?";
}

function getDisplayName(user: MemberRow["user"]) {
  if (!user) return "未知";
  if (user.firstName && user.lastName) return `${user.firstName} ${user.lastName}`;
  if (user.firstName) return user.firstName;
  return user.email || "未知";
}

export default function AdminStaffPlayers() {
  const { isAuthenticated, admin } = useAdminAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [grantTarget, setGrantTarget] = useState<MemberRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MemberRow | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [suspendTarget, setSuspendTarget] = useState<{
    member: MemberRow;
    status: "suspended" | "banned" | "active";
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // 本場域成員清單（嚴格隔離：只回傳 field_memberships WHERE fieldId = 本場域）
  const { data: membersData, isLoading } = useQuery<{ members: MemberRow[] }>({
    queryKey: ["/api/admin/memberships"],
    queryFn: () => fetchWithAdminAuth("/api/admin/memberships"),
    enabled: isAuthenticated,
  });

  // 可選角色清單
  const { data: roles } = useQuery<Role[]>({
    queryKey: ["/api/admin/roles"],
    queryFn: () => fetchWithAdminAuth("/api/admin/roles"),
    enabled: isAuthenticated,
  });

  const members = membersData?.members ?? [];
  const filtered = members.filter((m) => {
    const s = searchTerm.toLowerCase();
    if (!s) return true;
    return (
      m.user?.email?.toLowerCase().includes(s) ||
      m.user?.firstName?.toLowerCase().includes(s) ||
      m.user?.lastName?.toLowerCase().includes(s)
    );
  });

  const grantMutation = useMutation({
    mutationFn: async (payload: { userId: string; roleId: string }) => {
      const res = await apiRequest("POST", "/api/admin/memberships/grant", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 授權成功", description: "該玩家已成為管理員" });
      qc.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      setGrantTarget(null);
      setSelectedRoleId("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "授權失敗";
      toast({ title: "授權失敗", description: msg, variant: "destructive" });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", "/api/admin/memberships/revoke", { userId });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ 已撤銷管理權限",
        description: `已失效 ${data.revokedSessions ?? 0} 個登入 Session，已 email 通知當事人`,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      setRevokeTarget(null);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "撤銷失敗";
      toast({ title: "撤銷失敗", description: msg, variant: "destructive" });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: async (payload: {
      userId: string;
      status: "suspended" | "banned" | "active";
      reason?: string;
    }) => {
      const res = await apiRequest("POST", "/api/admin/memberships/suspend", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "✅ 已更新玩家狀態", description: "已 email 通知當事人" });
      qc.invalidateQueries({ queryKey: ["/api/admin/memberships"] });
      setSuspendTarget(null);
      setSuspendReason("");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "操作失敗";
      toast({ title: "操作失敗", description: msg, variant: "destructive" });
    },
  });

  const selfAccountId = admin?.accountId;

  return (
    <UnifiedAdminLayout title="玩家管理">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              本場域玩家（{members.length}）
            </CardTitle>
            <CardDescription>
              🔒 僅顯示在本場域有會員記錄的玩家。授權後可進入後台管理。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="搜尋 Email / 姓名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {isLoading ? (
              <ListSkeleton count={5} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={Users}
                title={searchTerm ? "找不到符合的玩家" : "本場域尚無玩家"}
                description={
                  searchTerm
                    ? "改變搜尋條件"
                    : "當玩家掃 QR 進入本場域遊戲後，自動加入成員清單"
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>玩家</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>加入本場域</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-center">管理員授權</TableHead>
                    <TableHead className="text-right">動作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((m) => {
                    const isSelf = m.user?.id === selfAccountId;
                    return (
                      <TableRow key={m.membership.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="w-7 h-7">
                              <AvatarImage src={m.user?.profileImageUrl || undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(m.user)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium">
                              {getDisplayName(m.user)}
                              {isSelf && (
                                <Badge variant="outline" className="ml-1 text-[10px]">
                                  自己
                                </Badge>
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {m.user?.email || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(m.membership.joinedAt)}
                        </TableCell>
                        <TableCell>
                          {m.membership.playerStatus === "active" ? (
                            <Badge variant="outline" className="text-[10px]">
                              正常
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              {m.membership.playerStatus === "suspended" ? "暫停" : "停權"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <Switch
                              checked={m.membership.isAdmin}
                              disabled={isSelf}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setGrantTarget(m);
                                  // 若已有 role 預選
                                  setSelectedRoleId(m.membership.adminRoleId ?? "");
                                } else {
                                  setRevokeTarget(m);
                                }
                              }}
                            />
                            {m.membership.isAdmin && m.role && (
                              <Badge className="bg-blue-600 text-[10px]">
                                {m.role.name}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {m.membership.isAdmin ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isSelf}
                                onClick={() => setRevokeTarget(m)}
                              >
                                <ShieldOff className="w-3.5 h-3.5 mr-1" />
                                撤銷
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setGrantTarget(m);
                                  setSelectedRoleId("");
                                }}
                              >
                                <Shield className="w-3.5 h-3.5 mr-1" />
                                授權
                              </Button>
                            )}
                            {!isSelf && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="sm" variant="ghost" className="px-2">
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {m.membership.playerStatus === "active" ? (
                                    <>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSuspendTarget({ member: m, status: "suspended" });
                                          setSuspendReason("");
                                        }}
                                      >
                                        <Ban className="w-3.5 h-3.5 mr-2 text-amber-600" />
                                        暫停玩家
                                      </DropdownMenuItem>
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setSuspendTarget({ member: m, status: "banned" });
                                          setSuspendReason("");
                                        }}
                                        className="text-destructive"
                                      >
                                        <Ban className="w-3.5 h-3.5 mr-2" />
                                        永久停權
                                      </DropdownMenuItem>
                                    </>
                                  ) : (
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSuspendTarget({ member: m, status: "active" });
                                        setSuspendReason("");
                                      }}
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 mr-2 text-emerald-600" />
                                      恢復玩家
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 授權對話框 */}
      <Dialog open={!!grantTarget} onOpenChange={(o) => !o && setGrantTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>授權為本場域管理員</DialogTitle>
            <DialogDescription>
              玩家「{getDisplayName(grantTarget?.user ?? null)}」將取得本場域後台存取權，
              請選擇角色決定具體權限。
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="選擇角色" />
              </SelectTrigger>
              <SelectContent>
                {roles
                  ?.filter(
                    (r) =>
                      r.systemRole !== "super_admin" &&
                      r.systemRole !== "player"
                  )
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.systemRole && r.systemRole !== "custom" && (
                        <span className="text-muted-foreground text-xs ml-1">
                          ({r.systemRole})
                        </span>
                      )}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrantTarget(null)}>
              取消
            </Button>
            <Button
              onClick={() => {
                if (!grantTarget?.user?.id || !selectedRoleId) return;
                grantMutation.mutate({
                  userId: grantTarget.user.id,
                  roleId: selectedRoleId,
                });
              }}
              disabled={!selectedRoleId || grantMutation.isPending}
            >
              確認授權
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 暫停玩家對話框（必填理由） */}
      <Dialog
        open={!!suspendTarget}
        onOpenChange={(o) => {
          if (!o) {
            setSuspendTarget(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspendTarget?.status === "active"
                ? "恢復玩家"
                : suspendTarget?.status === "banned"
                  ? "永久停權"
                  : "暫停玩家"}
            </DialogTitle>
            <DialogDescription>
              {suspendTarget?.status === "active"
                ? `將恢復「${getDisplayName(suspendTarget.member.user)}」的會員狀態，玩家可再次參與活動。`
                : suspendTarget?.status === "banned"
                  ? `「${getDisplayName(suspendTarget?.member.user ?? null)}」將被永久停權。此操作會保留歷史資料但禁止繼續參與。`
                  : `「${getDisplayName(suspendTarget?.member.user ?? null)}」將被暫時禁止參與活動，之後可恢復。`}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder={
                suspendTarget?.status === "active"
                  ? "（選填）恢復說明"
                  : "必填：說明理由，將 email 通知當事人"
              }
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={3}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {suspendReason.length} / 500
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason("");
              }}
            >
              取消
            </Button>
            <Button
              onClick={() => {
                if (!suspendTarget) return;
                if (
                  (suspendTarget.status === "suspended" ||
                    suspendTarget.status === "banned") &&
                  !suspendReason.trim()
                ) {
                  toast({
                    title: "請填寫理由",
                    description: "暫停或停權時必須說明理由",
                    variant: "destructive",
                  });
                  return;
                }
                suspendMutation.mutate({
                  userId: suspendTarget.member.user!.id,
                  status: suspendTarget.status,
                  reason: suspendReason.trim() || undefined,
                });
              }}
              variant={suspendTarget?.status === "active" ? "default" : "destructive"}
              disabled={suspendMutation.isPending}
            >
              {suspendTarget?.status === "active" ? "確認恢復" : "確認執行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 撤銷確認 */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>撤銷管理員授權</AlertDialogTitle>
            <AlertDialogDescription>
              「{getDisplayName(revokeTarget?.user ?? null)}」將無法再進入本場域後台。
              所有目前登入的 Session 會立即失效。玩家身份不受影響。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeTarget?.user?.id) {
                  revokeMutation.mutate(revokeTarget.user.id);
                }
              }}
              className="bg-destructive"
            >
              確認撤銷
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </UnifiedAdminLayout>
  );
}
