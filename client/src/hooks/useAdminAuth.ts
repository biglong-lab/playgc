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
  
  const { data, isLoading, error, refetch } = useQuery<AdminSessionResponse>({
    queryKey: ["/api/admin/session"],
    queryFn: fetchAdminSession,
    staleTime: 1000 * 60 * 5,
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
