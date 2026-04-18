import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserCog, Pencil, KeyRound, UserCheck } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { ListSkeleton } from "@/components/shared/LoadingSkeleton";
import type { AdminAccount, Role } from "./types";
import { STATUS_LABELS, STATUS_VARIANTS, formatDate } from "./types";

interface AccountTableProps {
  accounts: AdminAccount[] | undefined;
  isLoading: boolean;
  roles: Role[] | undefined;
  onEdit: (account: AdminAccount) => void;
  onResetPassword: (account: AdminAccount) => void;
  onApprove: (account: AdminAccount, defaultRoleId: string) => void;
}

/** 帳號列表表格 */
export function AccountTable({
  accounts,
  isLoading,
  roles,
  onEdit,
  onResetPassword,
  onApprove,
}: AccountTableProps) {
  if (isLoading) {
    return <ListSkeleton count={5} />;
  }

  if (!accounts || accounts.length === 0) {
    return (
      <EmptyState
        icon={UserCog}
        title="尚無管理員帳號"
        description="新帳號可由上方「新增帳號」建立，或待玩家申請管理權限後於此審核"
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>帳號</TableHead>
          <TableHead>顯示名稱</TableHead>
          <TableHead>場域</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>狀態</TableHead>
          <TableHead>最後登入</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {accounts.map((account) => (
          <TableRow key={account.id} data-testid={`row-account-${account.id}`}>
            <TableCell className="font-mono">
              {account.username || (
                <span className="text-muted-foreground italic">
                  （Firebase 登入）
                </span>
              )}
            </TableCell>
            <TableCell>{account.displayName || "-"}</TableCell>
            <TableCell>
              {account.field ? (
                <Badge variant="outline">{account.field.code}</Badge>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>
              {account.role ? (
                <Badge>{account.role.name}</Badge>
              ) : (
                <span className="text-muted-foreground">未指派</span>
              )}
            </TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANTS[account.status] || "secondary"}>
                {STATUS_LABELS[account.status] || account.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatDate(account.lastLoginAt)}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {account.status === "pending" && (
                  <Button
                    variant="default"
                    size="sm"
                    data-testid={`button-approve-account-${account.id}`}
                    onClick={() => {
                      const defaultRole = roles?.find(
                        (r) => r.systemRole === "field_executor",
                      );
                      onApprove(account, defaultRole?.id || "");
                    }}
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    授權
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid={`button-edit-account-${account.id}`}
                  onClick={() => onEdit(account)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid={`button-reset-password-${account.id}`}
                  onClick={() => onResetPassword(account)}
                >
                  <KeyRound className="w-4 h-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
