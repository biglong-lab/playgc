import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";

export interface AdminPrincipal {
  id: string;
  accountId: string;
  fieldId: string;
  fieldCode: string;
  fieldName: string;
  username: string;
  displayName: string | null;
  roleId: string | null;
  systemRole: string;
  permissions: string[];
}

interface AdminSessionResponse {
  authenticated: boolean;
  admin?: AdminPrincipal;
}

async function fetchAdminSession(): Promise<AdminSessionResponse> {
  const response = await fetch("/api/admin/session", {
    credentials: "include",
  });
  
  if (!response.ok) {
    return { authenticated: false };
  }
  
  return response.json();
}

export function useAdminAuth(options?: { redirectTo?: string }) {
  const [, navigate] = useLocation();
  const redirectTo = options?.redirectTo ?? "/admin/login";
  
  // 🆕 staleTime 從 5 分鐘降到 30 秒、加 refetchOnWindowFocus，確保：
  //   1. 切場域後（FieldSelector invalidateQueries "/api/admin/*" 會觸發重取）session 的 fieldId 同步更新
  //   2. Tab 切回時自動檢查 session 是否仍有效（避免 cookie 過期但 UI 以為還在登入）
  //   3. 跨場域切換後 admin 物件的 fieldId / fieldCode / fieldName / permissions 都正確
  // queryKey 保持 "/api/admin/session"（後端根據 cookie 決定回傳哪個 session），
  // 不用把 fieldId 放進 key — fieldId 是 server 端的 token 狀態，不該當成 client key 分片。
  const { data, isLoading, error, refetch } = useQuery<AdminSessionResponse>({
    queryKey: ["/api/admin/session"],
    queryFn: fetchAdminSession,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  
  const isAuthenticated = data?.authenticated ?? false;
  const admin = data?.admin ?? null;
  
  useEffect(() => {
    if (!isLoading && !isAuthenticated && redirectTo) {
      navigate(redirectTo);
    }
  }, [isLoading, isAuthenticated, redirectTo, navigate]);
  
  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.systemRole === "super_admin") return true;
    return admin.permissions.includes(permission);
  };
  
  const hasAnyPermission = (permissions: string[]): boolean => {
    return permissions.some(hasPermission);
  };
  
  const hasAllPermissions = (permissions: string[]): boolean => {
    return permissions.every(hasPermission);
  };
  
  const logout = async () => {
    await fetch("/api/admin/logout", {
      method: "POST",
      credentials: "include",
    });
    navigate("/admin/login");
  };
  
  return {
    admin,
    isAuthenticated,
    isLoading,
    error,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    logout,
    refetch,
  };
}

export function useRequireAdminAuth() {
  return useAdminAuth({ redirectTo: "/admin/login" });
}
