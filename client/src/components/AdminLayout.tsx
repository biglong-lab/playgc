import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase";
import {
  Gamepad2, Settings, Cpu, BarChart3,
  Trophy, Home, LogOut, Activity, Shield, Library, Sliders,
} from "lucide-react";

const menuItems = [
  { title: "總覽", icon: Home, path: "/admin" },
  { title: "遊戲管理", icon: Gamepad2, path: "/admin/games" },
  { title: "模組庫", icon: Library, path: "/admin/templates" },
  { title: "進行中場次", icon: Activity, path: "/admin/sessions" },
  { title: "設備管理", icon: Cpu, path: "/admin/devices" },
  { title: "數據分析", icon: BarChart3, path: "/admin/analytics" },
  { title: "排行榜", icon: Trophy, path: "/admin/leaderboard" },
  { title: "場域設定", icon: Sliders, path: "/admin/field-settings" },
  { title: "系統設定", icon: Settings, path: "/admin/settings" },
];

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export function useAdminAccess() {
  const { user, isLoading } = useAuth();
  
  const hasAccess = !isLoading && user && (user.role === "admin" || user.role === "creator");
  
  return {
    user,
    isLoading,
    hasAccess,
    isAdmin: user?.role === "admin",
    isCreator: user?.role === "creator",
  };
}

export default function AdminLayout({ children, title, actions }: AdminLayoutProps) {
  const { user, firebaseUser, isLoading, hasAccess, isSignedIn } = { ...useAdminAccess(), ...useAuth() };
  const [location, setLocation] = useLocation();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  useEffect(() => {
    if (!isLoading && user && !hasAccess) {
      window.location.href = "/";
    }
  }, [isLoading, user, hasAccess]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) {
    setLocation("/");
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
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
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-sm">賈村競技場</h1>
                <p className="text-xs text-sidebar-foreground/60">管理後台</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>主選單</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton 
                        asChild
                        isActive={location === item.path || 
                          (item.path !== "/admin" && location.startsWith(item.path))}
                      >
                        <Link href={item.path}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={firebaseUser?.photoURL || user?.profileImageUrl || undefined} />
                  <AvatarFallback>
                    {(user?.firstName?.[0] || user?.email?.[0] || "U").toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.firstName || "管理員"}</span>
                  <Badge variant="outline" className="text-xs w-fit">
                    {user?.role === "admin" ? "管理員" : "創作者"}
                  </Badge>
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <LogOut className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="w-4 h-4 mr-2" />
                    登出
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="h-14 flex items-center justify-between gap-4 px-4 border-b border-border bg-background/95 backdrop-blur shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="font-display font-bold text-lg">{title}</h1>
            </div>
            {actions}
          </header>

          <main className="flex-1 overflow-auto p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
