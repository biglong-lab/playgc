// 對戰系統共用佈局元件 — 深色軍事風格
import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLoginHandlers } from "@/hooks/useLoginHandlers";
import { LoginDialog } from "@/components/landing/LoginDialog";
import { isEmbeddedBrowser } from "@/components/landing/EmbeddedBrowserWarning";
import { ArrowLeft, Bell, LogIn } from "lucide-react";

interface BattleLayoutProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  /** 標題列右側額外操作按鈕 */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/** 登入按鈕（對戰頁面用） */
function BattleLoginButton() {
  const [showLogin, setShowLogin] = useState(false);
  const handlers = useLoginHandlers(() => setShowLogin(false), { redirectTo: null });

  return (
    <>
      <Button
        variant="default"
        size="sm"
        className="gap-1.5"
        onClick={() => setShowLogin(true)}
      >
        <LogIn className="h-4 w-4" />
        登入
      </Button>
      <LoginDialog
        open={showLogin}
        onOpenChange={setShowLogin}
        isEmbeddedBrowser={isEmbeddedBrowser()}
        handlers={handlers}
      />
    </>
  );
}

/** 通知鈴鐺（含未讀數） */
function NotificationBell() {
  const { user } = useAuth();
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/battle/notifications/unread-count"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/notifications/unread-count");
        return res.json();
      } catch {
        return { count: 0 };
      }
    },
    enabled: !!user,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });

  const count = data?.count ?? 0;

  return (
    <Link href="/battle/notifications">
      <Button variant="ghost" size="sm" className="relative text-muted-foreground hover:text-foreground">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center font-number">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Button>
    </Link>
  );
}

/** 對戰系統共用佈局：深色背景 + sticky header */
export default function BattleLayout({
  title,
  subtitle,
  backHref = "/battle",
  headerRight,
  children,
}: BattleLayoutProps) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Sticky 導航列 */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Link href={backHref}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-display font-bold text-lg leading-tight truncate">{title}</h1>
              {subtitle && (
                <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {headerRight}
            {user ? <NotificationBell /> : <BattleLoginButton />}
          </div>
        </div>
      </header>

      {/* 內容區（底部加上安全邊距） */}
      <main className="max-w-4xl mx-auto px-4 py-6 pb-safe">
        {children}
      </main>
    </div>
  );
}
