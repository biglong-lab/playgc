// 對戰系統共用佈局元件 — 深色軍事風格
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getIdToken } from "@/lib/firebase";
import { ArrowLeft, Bell, Swords } from "lucide-react";

interface BattleLayoutProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  /** 標題列右側額外操作按鈕 */
  headerRight?: React.ReactNode;
  children: React.ReactNode;
}

/** 通知鈴鐺（含未讀數） */
function NotificationBell() {
  const { data } = useQuery<{ count: number }>({
    queryKey: ["/api/battle/notifications/unread-count"],
    queryFn: async () => {
      const token = await getIdToken();
      const res = await fetch("/api/battle/notifications/unread-count", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return { count: 0 };
      return res.json();
    },
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
            {user && <NotificationBell />}
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
