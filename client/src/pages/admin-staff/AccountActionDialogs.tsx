import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

        <div className="space-y-2 py-4">
          <Label htmlFor="approveRole">指派角色</Label>
          <Select value={approveRoleId} onValueChange={onApproveRoleIdChange}>
            <SelectTrigger data-testid="select-approve-role">
              <SelectValue placeholder="選擇角色（可選）" />
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

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onApproveRoleIdChange("")}>
            取消
          </AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-approve"
            onClick={() => {
              if (!approveRoleId) {
                toast({ title: "請選擇角色", variant: "destructive" });
                return;
              }
              onConfirm();
            }}
            disabled={isPending || !approveRoleId}
          >
            {isPending ? "處理中..." : "確認授權"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
