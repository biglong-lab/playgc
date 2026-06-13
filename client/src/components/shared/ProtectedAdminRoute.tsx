import { type ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import { useRequireAdminAuth } from "@/hooks/useAdminAuth";
import ForbiddenPage from "./ForbiddenPage";

interface ProtectedAdminRouteProps {
  children: ReactNode;
  /** 可選：需要的權限，未授權顯示 403 */
  requiredPermission?: string;
}

/**
 * 場域執行者（field_executor）= 純現場人員：登入直接進現場模式、不看後台設定。
 * 只允許停留在現場相關頁面，其餘 /admin 一律導回 /pos。
 */
function isFieldStaffAllowed(loc: string): boolean {
  return (
    loc.startsWith("/pos") ||
    loc.startsWith("/admin/troubleshoot") ||
    loc.startsWith("/admin/scenario-qr-print")
  );
}

export default function ProtectedAdminRoute({
  children,
  requiredPermission,
}: ProtectedAdminRouteProps) {
  const { isLoading, isAuthenticated, hasPermission, admin } = useRequireAdminAuth();
  const [location, navigate] = useLocation();

  const isFieldStaff = admin?.systemRole === "field_executor";
  const blockedForFieldStaff = isFieldStaff && !isFieldStaffAllowed(location);

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
