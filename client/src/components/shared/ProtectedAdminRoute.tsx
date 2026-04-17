import { type ReactNode } from "react";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import ForbiddenPage from "./ForbiddenPage";

interface ProtectedAdminRouteProps {
  children: ReactNode;
  /** 可選：需要的權限，未授權顯示 403 */
  requiredPermission?: string;
}

export default function ProtectedAdminRoute({
  children,
  requiredPermission,
}: ProtectedAdminRouteProps) {
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
      <ForbiddenPage
        description={`此頁面需要「${requiredPermission}」權限`}
        suggestedPath="/admin"
        suggestedLabel="返回管理後台"
      />
    );
  }

  return <>{children}</>;
}
