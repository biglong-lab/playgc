// 等待授權審核視圖
import { Button } from "@/components/ui/button";
import { Shield, LogOut } from "lucide-react";
import { signOut as firebaseSignOut } from "@/lib/firebase";

interface PendingAuthViewProps {
  fieldCode: string;
  email?: string | null;
  isPending: boolean;
  onRecheck: () => void;
  onBackToField: () => void;
}

export default function PendingAuthView({
  fieldCode,
  email,
  isPending,
  onRecheck,
  onBackToField,
}: PendingAuthViewProps) {
  const handleSignOutAndBack = async () => {
    await firebaseSignOut();
    onBackToField();
  };

  return (
    <div className="space-y-4 text-center">
      <div className="p-3 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">場域編號</p>
        <p className="font-mono font-bold text-lg">{fieldCode}</p>
      </div>

      <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
        <div className="mx-auto w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center">
          <Shield className="w-6 h-6 text-amber-500" />
        </div>
        <h3 className="font-semibold text-amber-600 dark:text-amber-400">等待授權中</h3>
        <p className="text-sm text-muted-foreground">
          您的管理員權限申請已提交。<br />
          請聯繫場域管理員進行審核授權。
        </p>
        {email && (
          <p className="text-xs text-muted-foreground mt-2">
            申請帳號：{email}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onRecheck}
          disabled={isPending}
        >
          {isPending ? "檢查中..." : "重新檢查授權狀態"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={handleSignOutAndBack}
        >
          <LogOut className="w-4 h-4 mr-2" />
          登出並切換帳號
        </Button>
      </div>
    </div>
  );
}
