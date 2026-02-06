// 目前登入使用者顯示元件
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

interface CurrentUserBadgeProps {
  email?: string | null;
  displayName?: string | null;
  onSignOut: () => void;
}

export default function CurrentUserBadge({
  email,
  displayName,
  onSignOut,
}: CurrentUserBadgeProps) {
  return (
    <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
      <div className="text-sm">
        <span className="text-muted-foreground">已登入：</span>
        <span className="ml-1 font-medium">{email || displayName}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onSignOut}
      >
        <LogOut className="w-4 h-4" />
      </Button>
    </div>
  );
}
