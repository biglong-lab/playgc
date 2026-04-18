// 🌐 平台管理後台 Layout — SaaS 平台層專用
// 與場域管理後台（UnifiedAdminLayout）視覺上明確區分（藍色系 vs 紫紅）
import { Link, useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import CommandPalette from "@/components/CommandPalette";
import AutoBreadcrumb from "@/components/shared/AutoBreadcrumb";
import ForbiddenPage from "@/components/shared/ForbiddenPage";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Globe,
  LayoutDashboard,
  Building2,
  Package,
  DollarSign,
  ToggleLeft,
  LogOut,
  Inbox,
  BarChart3,
  Settings,
} from "lucide-react";

interface PlatformMenuItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PlatformMenuGroup {
  label: string;
  items: PlatformMenuItem[];
}

const PLATFORM_MENU_GROUPS: PlatformMenuGroup[] = [
  {
    label: "平台總覽",
    items: [
      { label: "儀表板", path: "/platform", icon: LayoutDashboard },
    ],
  },
  {
    label: "場域與方案",
    items: [
      { label: "場域管理", path: "/platform/fields", icon: Building2 },
      { label: "場域申請", path: "/platform/applications", icon: Inbox },
      { label: "訂閱方案", path: "/platform/plans", icon: Package },
      { label: "功能開關", path: "/platform/feature-flags", icon: ToggleLeft },
    ],
  },
  {
    label: "財務",
    items: [
      { label: "平台營收", path: "/platform/revenue", icon: DollarSign },
    ],
  },
];

interface PlatformAdminLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export default function PlatformAdminLayout({ children, title, actions }: PlatformAdminLayoutProps) {
  const [location] = useLocation();
  const { admin, isLoading, isAuthenticated, logout } = useAdminAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !admin) return null;

  // 檢查是否為平台管理員（super_admin 或 platform_admins 表中有資料）
  const isSuperAdmin = admin.systemRole === "super_admin";
  if (!isSuperAdmin) {
    return (
      <ForbiddenPage
        title="平台管理員專區"
        description="此區域僅限平台方使用，場域管理員請返回管理後台"
        suggestedPath="/admin"
        suggestedLabel="🏢 返回場域管理"
      />
    );
  }

  const displayName = admin.displayName || admin.username || "平台管理員";
  const initials = displayName[0]?.toUpperCase() ?? "P";

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar className="border-r-2 border-blue-500/20">
          <SidebarHeader className="border-b">
            <div className="flex items-center gap-2 px-2 py-3">
              <div className="w-9 h-9 rounded-md bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">平台管理後台</p>
                <p className="text-xs text-muted-foreground truncate">大哉遊戲雲</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent>
            {/* 🏢 返回場域管理入口 */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      asChild
                      className="bg-gradient-to-r from-violet-50 to-rose-50 dark:from-violet-950/30 dark:to-rose-950/30 hover:from-violet-100 hover:to-rose-100 text-violet-900 dark:text-violet-100 font-medium"
                    >
                      <Link href="/admin">
                        <span className="text-base">🏢</span>
                        <span>返回場域管理</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {PLATFORM_MENU_GROUPS.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const isActive =
                        location === item.path ||
                        (item.path !== "/platform" && location.startsWith(item.path));
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActive}>
                            <Link href={item.path}>
                              <a className="flex items-center gap-2">
                                <Icon className="w-4 h-4" />
                                <span>{item.label}</span>
                              </a>
                            </Link>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </SidebarContent>

          <SidebarFooter className="border-t">
            <div className="flex items-center gap-2 px-2 py-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-blue-600 text-white text-xs">{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{displayName}</p>
                <Badge variant="outline" className="text-[10px] h-4 px-1 border-blue-500 text-blue-700">
                  🌐 平台管理員
                </Badge>
              </div>
              <button
                onClick={logout}
                className="p-1 hover:bg-muted rounded"
                aria-label="登出"
                title="登出"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
            <div className="flex flex-col gap-1.5 px-4 pt-2 pb-2">
              <AutoBreadcrumb className="hidden md:flex" />
              <div className="flex items-center gap-3 min-h-[36px]">
                <SidebarTrigger />
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-900 border-blue-300">
                    🌐 平台
                  </Badge>
                  <h1 className="text-lg font-semibold truncate">{title}</h1>
                </div>
                {actions}
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-auto bg-muted/30">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
    </SidebarProvider>
  );
}
