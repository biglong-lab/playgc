import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import type { AdminAccount, AccountFormData, Role, Field } from "./types";

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAccount: AdminAccount | null;
  formData: AccountFormData;
  onFormDataChange: (data: AccountFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  roles: Role[] | undefined;
  fields: Field[] | undefined;
  isPending: boolean;
}

/** 新增/編輯帳號對話框 */
export function AccountFormDialog({
  open,
  onOpenChange,
  editingAccount,
  formData,
  onFormDataChange,
  onSubmit,
  onClose,
  roles,
  fields,
  isPending,
}: AccountFormDialogProps) {
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (key: keyof AccountFormData, value: string) => {
    onFormDataChange({ ...formData, [key]: value });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button data-testid="button-add-account">
          <Plus className="w-4 h-4 mr-2" />
          新增帳號
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingAccount ? "編輯帳號" : "新增管理員帳號"}
          </DialogTitle>
          <DialogDescription>
            {editingAccount ? "更新管理員帳號資訊" : "建立新的管理員帳號"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* 場域選擇（新增時才顯示） */}
          {!editingAccount && fields && fields.length > 1 && (
            <div className="space-y-2">
              <Label htmlFor="fieldId">所屬場域</Label>
              <Select
                value={formData.fieldId}
                onValueChange={(v) => updateField("fieldId", v)}
              >
                <SelectTrigger data-testid="select-field">
                  <SelectValue placeholder="選擇場域" />
                </SelectTrigger>
                <SelectContent>
                  {fields.map((field) => (
                    <SelectItem key={field.id} value={field.id}>
                      {field.name} ({field.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* 帳號 + 密碼 */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">帳號 *</Label>
              <Input
                id="username"
                data-testid="input-account-username"
                placeholder="登入帳號"
                value={formData.username}
                onChange={(e) => updateField("username", e.target.value)}
                disabled={!!editingAccount}
              />
            </div>

            {!editingAccount && (
              <div className="space-y-2">
                <Label htmlFor="password">密碼 *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    data-testid="input-account-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="登入密碼"
                    value={formData.password}
                    onChange={(e) => updateField("password", e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 顯示名稱 + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">顯示名稱</Label>
              <Input
                id="displayName"
                data-testid="input-account-displayname"
                placeholder="顯示名稱"
                value={formData.displayName}
                onChange={(e) => updateField("displayName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">電子郵件</Label>
              <Input
                id="email"
                data-testid="input-account-email"
                type="email"
                placeholder="電子郵件"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
              />
            </div>
          </div>

          {/* 角色選擇 */}
          <div className="space-y-2">
            <Label htmlFor="roleId">角色</Label>
            <Select
              value={formData.roleId}
              onValueChange={(v) => updateField("roleId", v)}
            >
              <SelectTrigger data-testid="select-role">
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
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              取消
            </Button>
            <Button
              type="submit"
              data-testid="button-submit-account"
              disabled={isPending}
            >
              {isPending
                ? "處理中..."
                : editingAccount
                  ? "更新"
                  : "新增"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
