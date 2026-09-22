import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import ForbiddenPage from "./ForbiddenPage";
import { FIELD_STAFF_ROLE, isFieldStaffAllowedPath } from "@/lib/pos-access";

interface ProtectedAdminRouteProps {
  children: ReactNode;
  /** 可選：需要的權限，未授權顯示 403 */
  requiredPermission?: string;
}

export default function ProtectedAdminRoute({
  children,
  requiredPermission,
}: ProtectedAdminRouteProps) {
  const { isLoading, isAuthenticated, hasPermission, admin } = useRequireAdminAuth();
  const [location, navigate] = useLocation();

  // 場域執行者（field_executor）= 純現場人員：只允許停留在現場相關頁面（規則見 lib/pos-access）
  const isFieldStaff = admin?.systemRole === FIELD_STAFF_ROLE;
  const blockedForFieldStaff = isFieldStaff && !isFieldStaffAllowedPath(location);

  // 場域執行者進到非現場頁面 → 導回現場模式
  useEffect(() => {
    if (!isLoading && isAuthenticated && blockedForFieldStaff) {
      navigate("/pos");
    }
  }, [isLoading, isAuthenticated, blockedForFieldStaff, navigate]);

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

  // 導向現場模式途中、不閃後台內容
  if (blockedForFieldStaff) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
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
