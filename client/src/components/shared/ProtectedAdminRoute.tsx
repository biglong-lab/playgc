import { type ReactNode } from "react";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import { ShieldAlert } from "lucide-react";

interface ProtectedAdminRouteProps {
  children: ReactNode;
  /** 可選：需要的權限，未授權顯示 403 */
  requiredPermission?: string;
}

export default function ProtectedAdminRoute({ children, requiredPermission }: ProtectedAdminRouteProps) {
  const { isLoading, isAuthenticated, hasPermission } = useRequireAdminAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredPermission && !hasPermission(requiredPermission)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-muted-foreground">
        <ShieldAlert className="w-12 h-12" />
        <p className="text-lg font-medium">權限不足</p>
        <p className="text-sm">您沒有存取此頁面的權限</p>
      </div>
    );
  }

  return <>{children}</>;
}
