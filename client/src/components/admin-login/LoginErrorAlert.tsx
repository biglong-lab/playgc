// 登入錯誤提示元件
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface LoginErrorAlertProps {
  error: string;
  email?: string | null;
  onSignOut: () => void;
}

export default function LoginErrorAlert({
  error,
  email,
  onSignOut,
}: LoginErrorAlertProps) {
  return (
    <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg space-y-3">
      <p className="text-sm text-destructive font-medium text-center">
        {error}
      </p>
      {email && (
        <p className="text-xs text-muted-foreground text-center">
          目前登入帳號：{email}
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        data-testid="button-firebase-signout"
        onClick={onSignOut}
      >
        <LogOut className="w-4 h-4 mr-2" />
        登出並切換帳號
      </Button>
    </div>
  );
}
