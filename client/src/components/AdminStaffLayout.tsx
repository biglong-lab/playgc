import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuthContext } from "@/contexts/AuthContext";
import { signInWithGoogle, signOut as firebaseSignOut, getIdToken } from "@/lib/firebase";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  LayoutDashboard,
  Users,
  Building2,
  UserCog,
  Key,
  FileText,
  Gamepad2,
  QrCode,
  LogOut,
  ChevronDown,
  Settings,
  Link2,
  Library,
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

interface AdminPrincipal {
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

interface AdminStaffLayoutProps {
  children: React.ReactNode;
}

async function fetchWithAdminAuth(url: string, options: RequestInit = {}) {
  const headers = {
    ...options.headers,
    "Content-Type": "application/json",
  };
  
  const response = await fetch(url, { ...options, headers, credentials: "include" });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error.message || "Request failed");
  }
  
  return response.json();
}

export default function AdminStaffLayout({ children }: AdminStaffLayoutProps) {
  const [location, navigate] = useLocation();
  const { toast } = useToast();
  const [admin, setAdmin] = useState<AdminPrincipal | null>(null);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const { isAuthenticated, firebaseUser } = useAuthContext();

  const { data: adminData, isLoading, error } = useQuery<AdminPrincipal>({
    queryKey: ["/api/admin/me"],
    queryFn: () => fetchWithAdminAuth("/api/admin/me"),
    retry: false,
  });

  useEffect(() => {
    if (adminData) {
      setAdmin(adminData);
      setHasCheckedAuth(true);
    }
  }, [adminData]);

  useEffect(() => {
    if (error || (!isLoading && !adminData && hasCheckedAuth)) {
      navigate("/admin-staff/login");
    }
  }, [error, isLoading, adminData, hasCheckedAuth, navigate]);

  const logoutMutation = useMutation({
    mutationFn: () => fetchWithAdminAuth("/api/admin/logout", { method: "POST" }),
    onSuccess: async () => {
      queryClient.clear();
      await firebaseSignOut();
      toast({ title: "已登出" });
      navigate("/admin-staff/login");
    },
  });

  const linkFirebaseMutation = useMutation({
    mutationFn: async () => {
      const token = await getIdToken();
      const response = await fetch("/api/admin/link-firebase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "連結失敗");
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "連結成功", description: "下次登入可直接使用 Google 帳號" });
      setShowLinkDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: "連結失敗", description: error.message, variant: "destructive" });
    },
  });

  const handleLinkFirebase = async () => {
    if (isAuthenticated) {
      linkFirebaseMutation.mutate();
    } else {
      try {
        await signInWithGoogle();
        linkFirebaseMutation.mutate();
      } catch (error) {
        toast({ 
          title: "登入失敗", 
          description: "Google 登入失敗，請重試",
          variant: "destructive" 
        });
      }
    }
  };

  const hasPermission = (permission: string): boolean => {
    if (!admin) return false;
    if (admin.systemRole === "super_admin") return true;
    return admin.permissions.includes(permission);
  };

  const menuItems = [
    {
      group: "系統總覽",
      items: [
        { title: "儀表板", icon: LayoutDashboard, href: "/admin-staff/dashboard", permission: null },
      ],
    },
    {
      group: "場域管理",
      items: [
        { title: "場域設定", icon: Building2, href: "/admin-staff/fields", permission: "field:manage" },
        { title: "遊戲管理", icon: Gamepad2, href: "/admin-staff/games", permission: "game:view" },
        { title: "QR Code", icon: QrCode, href: "/admin-staff/qrcodes", permission: "qr:generate" },
      ],
    },
    {
      group: "權限管理",
      items: [
        { title: "角色管理", icon: Key, href: "/admin-staff/roles", permission: "user:manage_roles" },
        { title: "管理員帳號", icon: UserCog, href: "/admin-staff/accounts", permission: "admin:manage_accounts" },
        { title: "玩家管理", icon: Users, href: "/admin-staff/players", permission: "user:view" },
      ],
    },
    {
      group: "系統記錄",
      items: [
        { title: "操作記錄", icon: FileText, href: "/admin-staff/audit-logs", permission: "admin:view_audit" },
      ],
    },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="border-b p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-sm">賈村保衛戰</h2>
                <p className="text-xs text-muted-foreground">管理後台</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            {menuItems.map((group) => {
              const visibleItems = group.items.filter(
                item => !item.permission || hasPermission(item.permission)
              );
              
              if (visibleItems.length === 0) return null;
              
              return (
                <SidebarGroup key={group.group}>
                  <SidebarGroupLabel>{group.group}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map((item) => (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            asChild
                            isActive={location === item.href}
                          >
                            <a href={item.href} data-testid={`menu-${item.href.replace(/\//g, "-")}`}>
                              <item.icon className="w-4 h-4" />
                              <span>{item.title}</span>
                            </a>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              );
            })}
          </SidebarContent>
          
          <SidebarFooter className="border-t p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(admin?.displayName || admin?.username || "?")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium truncate">
                      {admin?.displayName || admin?.username}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {admin?.fieldName}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem>
                  <Settings className="w-4 h-4 mr-2" />
                  帳號設定
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLinkFirebase} disabled={linkFirebaseMutation.isPending}>
                  <Link2 className="w-4 h-4 mr-2" />
                  連結 Google 帳號
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                  className="text-destructive"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between gap-2 p-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-2">
              {admin?.fieldCode && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                  {admin.fieldCode}
                </span>
              )}
              <ThemeToggle />
            </div>
          </header>
          
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>

      <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>連結 Google 帳號</DialogTitle>
            <DialogDescription>
              連結後，您可以使用場域編號 + Google 帳號快速登入管理後台，無需輸入密碼。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Button className="w-full" size="lg" onClick={handleLinkFirebase}>
              <Link2 className="w-4 h-4 mr-2" />
              登入並連結 Google 帳號
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              登入 Google 後將自動連結到您目前的管理員帳號
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
