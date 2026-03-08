// 戰隊管理面板 — 隊長/幹部操作（編輯、升降、踢人、轉讓）
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { getIdToken } from "@/lib/firebase";
import type { BattleClan, BattleClanMember } from "@shared/schema";
import { clanRoleLabels, type ClanRole } from "@shared/schema";
import { Settings, MoreVertical, Crown, ArrowUp, ArrowDown, UserMinus } from "lucide-react";

interface ClanMemberWithName extends BattleClanMember {
  displayName?: string;
}

interface ClanManagePanelProps {
  clan: BattleClan;
  members: ClanMemberWithName[];
  myRole: string;
  myUserId: string;
}

/** 認證 fetch 輔助 */
async function authFetch(url: string, options: RequestInit = {}) {
  const token = await getIdToken();
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    credentials: "include",
  });
}

export default function ClanManagePanel({ clan, members, myRole, myUserId }: ClanManagePanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTarget, setTransferTarget] = useState<ClanMemberWithName | null>(null);
  const [editName, setEditName] = useState(clan.name);
  const [editDesc, setEditDesc] = useState(clan.description ?? "");
  const [editTag, setEditTag] = useState(clan.tag);

  const isLeader = myRole === "leader";
  const isOfficer = myRole === "officer";
  if (!isLeader && !isOfficer) return null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/battle/clans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/battle/my/clan"] });
  };

  const editMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/battle/clans/${clan.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDesc || null, tag: editTag }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "更新失敗");
    },
    onSuccess: () => {
      toast({ title: "戰隊資訊已更新" });
      setShowEditDialog(false);
      invalidate();
    },
    onError: (err: Error) => toast({ title: "更新失敗", description: err.message, variant: "destructive" }),
  });

  const roleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await authFetch(`/api/battle/clans/${clan.id}/role`, {
        method: "POST",
        body: JSON.stringify({ userId, role }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "變更失敗");
    },
    onSuccess: () => {
      toast({ title: "角色已變更" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "變更失敗", description: err.message, variant: "destructive" }),
  });

  const kickMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      const res = await authFetch(`/api/battle/clans/${clan.id}/kick?targetUserId=${targetUserId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error || "踢出失敗");
    },
    onSuccess: () => {
      toast({ title: "成員已被踢出" });
      invalidate();
    },
    onError: (err: Error) => toast({ title: "踢出失敗", description: err.message, variant: "destructive" }),
  });

  const transferMutation = useMutation({
    mutationFn: async (newLeaderId: string) => {
      const res = await authFetch(`/api/battle/clans/${clan.id}/transfer`, {
        method: "POST",
        body: JSON.stringify({ newLeaderId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "轉讓失敗");
    },
    onSuccess: () => {
      toast({ title: "隊長已轉讓" });
      setShowTransferDialog(false);
      setTransferTarget(null);
      invalidate();
    },
    onError: (err: Error) => toast({ title: "轉讓失敗", description: err.message, variant: "destructive" }),
  });

  /** 取得成員可執行的操作 */
  function getMemberActions(member: ClanMemberWithName) {
    if (member.userId === myUserId) return [];
    const actions: { label: string; icon: typeof Crown; action: () => void }[] = [];

    if (isLeader) {
      if (member.role === "member") {
        actions.push({ label: "升為幹部", icon: ArrowUp, action: () => roleMutation.mutate({ userId: member.userId, role: "officer" }) });
      }
      if (member.role === "officer") {
        actions.push({ label: "降為隊員", icon: ArrowDown, action: () => roleMutation.mutate({ userId: member.userId, role: "member" }) });
      }
      actions.push({ label: "轉讓隊長", icon: Crown, action: () => { setTransferTarget(member); setShowTransferDialog(true); } });
      actions.push({ label: "踢出", icon: UserMinus, action: () => kickMutation.mutate(member.userId) });
    } else if (isOfficer && member.role === "member") {
      actions.push({ label: "踢出", icon: UserMinus, action: () => kickMutation.mutate(member.userId) });
    }

    return actions;
  }

  return (
    <>
      {/* 管理按鈕列 */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowEditDialog(true)}>
          <Settings className="h-4 w-4" /> 編輯戰隊
        </Button>
      </div>

      {/* 成員操作下拉選單 — 渲染在成員列表旁 */}
      {members.filter((m) => !m.leftAt).map((member) => {
        const actions = getMemberActions(member);
        if (actions.length === 0) return null;
        return (
          <div key={`manage-${member.id}`} className="hidden" data-manage-member={member.userId}>
            {/* 這些操作在 MemberActions 中被調用 */}
          </div>
        );
      })}

      {/* 編輯 Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>編輯戰隊</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>戰隊名稱</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={50} />
            </div>
            <div>
              <Label>標籤 (2-5 字元)</Label>
              <Input value={editTag} onChange={(e) => setEditTag(e.target.value)} maxLength={5} />
            </div>
            <div>
              <Label>描述（選填）</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} maxLength={200} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName || !editTag}>
              儲存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 轉讓確認 */}
      <AlertDialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認轉讓隊長</AlertDialogTitle>
            <AlertDialogDescription>
              你確定要將隊長轉讓給「{transferTarget?.displayName ?? transferTarget?.userId.slice(0, 8)}」嗎？此操作無法撤銷。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => transferTarget && transferMutation.mutate(transferTarget.userId)}
              disabled={transferMutation.isPending}
            >
              確認轉讓
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** 單一成員操作下拉 — 供 BattleClanDetail 使用 */
export function MemberActionMenu({
  clan, member, myRole, myUserId,
}: {
  clan: BattleClan;
  member: ClanMemberWithName;
  myRole: string;
  myUserId: string;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showTransfer, setShowTransfer] = useState(false);

  if (member.userId === myUserId) return null;
  const isLeader = myRole === "leader";
  const isOfficer = myRole === "officer";
  if (!isLeader && !isOfficer) return null;
  if (isOfficer && member.role !== "member") return null;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/battle/clans"] });
    queryClient.invalidateQueries({ queryKey: ["/api/battle/my/clan"] });
  };

  const handleRole = async (role: string) => {
    const res = await authFetch(`/api/battle/clans/${clan.id}/role`, {
      method: "POST",
      body: JSON.stringify({ userId: member.userId, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "變更失敗", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "角色已變更" });
    invalidate();
  };

  const handleKick = async () => {
    const res = await authFetch(`/api/battle/clans/${clan.id}/kick?targetUserId=${member.userId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "踢出失敗", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "成員已被踢出" });
    invalidate();
  };

  const handleTransfer = async () => {
    const res = await authFetch(`/api/battle/clans/${clan.id}/transfer`, {
      method: "POST",
      body: JSON.stringify({ newLeaderId: member.userId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "轉讓失敗", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "隊長已轉讓" });
    setShowTransfer(false);
    invalidate();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {isLeader && member.role === "member" && (
            <DropdownMenuItem onClick={() => handleRole("officer")}>
              <ArrowUp className="h-4 w-4 mr-2" /> 升為幹部
            </DropdownMenuItem>
          )}
          {isLeader && member.role === "officer" && (
            <DropdownMenuItem onClick={() => handleRole("member")}>
              <ArrowDown className="h-4 w-4 mr-2" /> 降為隊員
            </DropdownMenuItem>
          )}
          {isLeader && (
            <DropdownMenuItem onClick={() => setShowTransfer(true)}>
              <Crown className="h-4 w-4 mr-2" /> 轉讓隊長
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={handleKick} className="text-destructive">
            <UserMinus className="h-4 w-4 mr-2" /> 踢出
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={showTransfer} onOpenChange={setShowTransfer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認轉讓隊長</AlertDialogTitle>
            <AlertDialogDescription>
              你確定要將隊長轉讓給「{member.displayName ?? member.userId.slice(0, 8)}」嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleTransfer}>確認轉讓</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
