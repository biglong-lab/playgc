import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { AlertCircle, Key, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { AdminAccount, Role } from "./types";

interface ResetPasswordDialogProps {
  account: AdminAccount | null;
  onClose: () => void;
  newPassword: string;
  onNewPasswordChange: (val: string) => void;
  onConfirm: () => void;
  isPending: boolean;
}

/** 重設密碼對話框 */
export function ResetPasswordDialog({
  account,
  onClose,
  newPassword,
  onNewPasswordChange,
  onConfirm,
  isPending,
}: ResetPasswordDialogProps) {
  const { toast } = useToast();

  return (
    <AlertDialog open={!!account} onOpenChange={() => onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>重設密碼</AlertDialogTitle>
          <AlertDialogDescription>
            為帳號「{account?.username}」設定新密碼
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="newPassword">新密碼</Label>
          <Input
            id="newPassword"
            data-testid="input-new-password"
            type="password"
            placeholder="請輸入新密碼（至少 6 個字元）"
            value={newPassword}
            onChange={(e) => onNewPasswordChange(e.target.value)}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onNewPasswordChange("")}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-reset-password"
            onClick={() => {
              if (account && newPassword.length >= 6) {
                onConfirm();
              } else {
                toast({
                  title: "密碼至少需要 6 個字元",
                  variant: "destructive",
                });
              }
            }}
            disabled={isPending}
          >
            {isPending ? "處理中..." : "確認重設"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface ApproveAccountDialogProps {
  account: AdminAccount | null;
  onClose: () => void;
  approveRoleId: string;
  onApproveRoleIdChange: (val: string) => void;
  onConfirm: () => void;
  roles: Role[] | undefined;
  isPending: boolean;
}

/** 授權帳號對話框 */
export function ApproveAccountDialog({
  account,
  onClose,
  approveRoleId,
  onApproveRoleIdChange,
  onConfirm,
  roles,
  isPending,
}: ApproveAccountDialogProps) {
  const { toast } = useToast();

  const displayName =
    account?.displayName ||
    account?.email ||
    account?.username ||
    "此帳號";

  // 🆕 偵測場域還沒建立任何角色的情況（後浦初次授權就是這樣）
  const hasNoRoles = !roles || roles.length === 0;

  return (
    <AlertDialog
      open={!!account}
      onOpenChange={() => {
        onClose();
        onApproveRoleIdChange("");
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>授權帳號</AlertDialogTitle>
          <AlertDialogDescription>
            授權「{displayName}」，請選擇要指派的角色
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasNoRoles ? (
          // 🆕 場域尚未建立角色 — 引導使用者先去角色管理建立，不要卡在空下拉
          <div className="space-y-3 py-4">
            <div
              className="flex items-start gap-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/10"
              data-testid="no-roles-warning"
            >
              <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                  本場域尚未建立任何角色
                </p>
                <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                  授權管理員前，請先到「角色管理」建立角色（例如：場域主管、活動執行者），
                  再回到此頁選擇指派。
                </p>
              </div>
            </div>
            <Link href="/admin/roles">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                data-testid="link-goto-roles-from-approve"
                onClick={() => {
                  onClose();
                  onApproveRoleIdChange("");
                }}
              >
                <Key className="w-4 h-4" />
                前往角色管理
                <ExternalLink className="w-3 h-3 ml-auto opacity-60" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-2 py-4">
            <Label htmlFor="approveRole">指派角色</Label>
            <Select value={approveRoleId} onValueChange={onApproveRoleIdChange}>
              <SelectTrigger data-testid="select-approve-role">
                <SelectValue placeholder="選擇角色" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              請選擇一個角色以授權此帳號
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onApproveRoleIdChange("")}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-approve"
            onClick={() => {
              if (hasNoRoles) {
                toast({
                  title: "本場域尚無角色",
                  description: "請先到「角色管理」建立角色",
                  variant: "destructive",
                });
                return;
              }
              if (!approveRoleId) {
                toast({ title: "請選擇角色", variant: "destructive" });
                return;
              }
              onConfirm();
            }}
            disabled={isPending || hasNoRoles || !approveRoleId}
          >
            {isPending ? "處理中..." : "確認授權"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
