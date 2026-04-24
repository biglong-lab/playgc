// 統一管理端 Layout — 合併 AdminLayout + AdminStaffLayout
// 使用 JWT/RBAC 認證，根據角色權限動態顯示菜單
import { Link, useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useCurrentField } from "@/providers/FieldThemeProvider";
import { ADMIN_MENU_GROUPS, SYSTEM_ROLE_LABELS, filterMenuByPermissions, filterMenuByModules } from "@/config/admin-menu";
import FieldSelector from "@/components/FieldSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import CommandPalette from "@/components/CommandPalette";
import FieldOnboardingWizard from "@/components/FieldOnboardingWizard";
import AutoBreadcrumb from "@/components/shared/AutoBreadcrumb";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shield, LogOut, ChevronDown, Settings } from "lucide-react";

interface UnifiedAdminLayoutProps {
  children: React.ReactNode;
  title: string;
  actions?: React.ReactNode;
}

export default function UnifiedAdminLayout({ children, title, actions }: UnifiedAdminLayoutProps) {
  const [location] = useLocation();
  const { admin, isLoading, isAuthenticated, hasPermission, logout } = useAdminAuth();
  const currentField = useCurrentField();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated || !admin) {
    return null;
  }

  // 先過濾權限，再根據當前場域模組開關過濾菜單
  const byPermission = filterMenuByPermissions(ADMIN_MENU_GROUPS, hasPermission);
  const filteredMenuGroups = filterMenuByModules(byPermission, currentField?.modules);
  const isSuperAdmin = admin.systemRole === "super_admin";

  // 🆕 登出前確認
  const handleLogout = () => {
    if (!window.confirm("確定要登出管理後台？\n\n未儲存的變更可能會遺失。")) return;
    logout();
  };
  const roleLabel = SYSTEM_ROLE_LABELS[admin.systemRole] ?? admin.systemRole;
  const displayName = admin.displayName || admin.username || "管理員";
  const initials = displayName[0].toUpperCase();

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AdminSidebar
          filteredMenuGroups={filteredMenuGroups}
          location={location}
          isSuperAdmin={isSuperAdmin}
          displayName={displayName}
          initials={initials}
          roleLabel={roleLabel}
          fieldName={admin.fieldName}
          onLogout={logout}
        />

        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex flex-col gap-1.5 px-4 pt-2 pb-2 border-b border-border bg-background/95 backdrop-blur shrink-0">
            <AutoBreadcrumb className="hidden md:flex" />
            <div className="flex items-center justify-between gap-4 min-h-[36px]">
              <div className="flex items-center gap-3 min-w-0">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <FieldSelector
                  currentFieldId={admin.fieldId}
                  currentFieldName={admin.fieldName}
                  isSuperAdmin={isSuperAdmin}
                />
                <h1 className="font-display font-bold text-lg truncate">{title}</h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const event = new KeyboardEvent("keydown", {
                      key: "k",
                      metaKey: true,
                      ctrlKey: true,
                      bubbles: true,
                    });
                    document.dispatchEvent(event);
                  }}
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground bg-muted hover:bg-muted/80 rounded-md border border-border transition-colors"
                  title="快速搜尋 (⌘K)"
                >
                  <span>🔍 快速跳轉</span>
                  <kbd className="px-1 py-0.5 bg-background rounded text-[10px] font-mono">⌘K</kbd>
                </button>
                {actions}
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6 bg-muted/30">
            {children}
          </main>
        </div>
      </div>
      <CommandPalette />
      <FieldOnboardingWizard />
    </SidebarProvider>
  );
}

// ============================================================================
// Sidebar 子元件（避免主元件過長）
// ============================================================================

interface AdminSidebarProps {
  filteredMenuGroups: ReturnType<typeof filterMenuByPermissions>;
  location: string;
  isSuperAdmin: boolean;
  displayName: string;
  initials: string;
  roleLabel: string;
  fieldName: string;
  onLogout: () => void;
}

function AdminSidebar({
  filteredMenuGroups,
  location,
  isSuperAdmin,
  displayName,
  initials,
  roleLabel,
  fieldName,
  onLogout,
}: AdminSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            {/* 🔒 場域隔離：主標永遠是當前場域名稱（不再硬編碼「賈村競技場」）*/}
            <h2 className="font-bold text-sm truncate" title={fieldName}>
              {fieldName || "管理後台"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {isSuperAdmin ? "超級管理員" : "場域管理員"}
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* 🌐 平台管理入口（僅 super_admin 可見）*/}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/platform" || location.startsWith("/platform/")}
                    className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 hover:from-blue-100 hover:to-indigo-100 text-blue-900 dark:text-blue-100 font-medium"
                  >
                    <Link href="/platform">
                      <span className="text-base">🌐</span>
                      <span>前往平台管理</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {filteredMenuGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="flex items-center gap-1.5 font-semibold">
              {group.emoji && <span className="text-sm">{group.emoji}</span>}
              <span>{group.label}</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      asChild
                      isActive={
                        location === item.path ||
                        (item.path !== "/admin" && location.startsWith(item.path))
                      }
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-3 h-auto py-2">
              <Avatar className="w-8 h-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <Badge variant="outline" className="text-xs">
                  {roleLabel}
                </Badge>
              </div>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem>
              <Settings className="w-4 h-4 mr-2" />
              帳號設定
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              登出
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
