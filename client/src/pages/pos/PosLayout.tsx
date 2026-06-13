// 📱 POS 工作站 layout（2026-05-18）
//
// 給現場工作人員、mobile-first（不是 admin 完整後台）
// 簡潔大字、底部固定導航

import { Link, useLocation } from "wouter";
import { ReactNode, useEffect, useState } from "react";
import { Home, ScanLine, CalendarCheck, DollarSign, Ticket, LifeBuoy, Settings, WifiOff } from "lucide-react";

interface PosLayoutProps {
  title: string;
  children: ReactNode;
  backTo?: string;
}

export default function PosLayout({ title, children, backTo }: PosLayoutProps) {
  const [location] = useLocation();
  // 🆕 2026-05-18 離線指示器
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // 現場模式固定底部選單（2026-06-13）：現場最常用 6 項
  // 小結移到首頁大按鈕（每日結算、頻率較低）；排解＝排除遊戲障礙
  const tabs = [
    { path: "/pos", label: "首頁", icon: Home },
    { path: "/pos/scan", label: "掃描", icon: ScanLine },
    { path: "/pos/bookings/today", label: "預約", icon: CalendarCheck },
    { path: "/pos/checkout", label: "收款", icon: DollarSign },
    { path: "/pos/voucher", label: "核銷", icon: Ticket },
    { path: "/admin/troubleshoot", label: "排解", icon: LifeBuoy },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {!isOnline && (
        <div className="bg-red-600 text-white text-center py-1 text-xs flex items-center justify-center gap-2 sticky top-0 z-20">
          <WifiOff className="w-3 h-3" />
          目前離線、操作將無法同步、請檢查網路
        </div>
      )}
      <header className="bg-white dark:bg-slate-900 border-b sticky top-0 z-10">
        <div className="flex items-center gap-3 px-4 py-3 max-w-md mx-auto">
          {backTo && (
            <Link href={backTo}>
              <button className="text-sm text-muted-foreground hover-elevate p-1 rounded" aria-label="返回">
                ←
              </button>
            </Link>
          )}
          <h1 className="font-bold text-lg flex-1">{title}</h1>
          <Link href="/admin">
            <button
              className="text-xs text-muted-foreground hover-elevate p-1.5 rounded flex items-center gap-1"
              aria-label="切換到後台"
              title="切換到完整後台"
            >
              <Settings className="w-4 h-4" />
              後台
            </button>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 pb-24">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t">
        <div className="max-w-md mx-auto grid grid-cols-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = location === t.path || (t.path !== "/pos" && location.startsWith(t.path));
            return (
              <Link key={t.path} href={t.path}>
                <button
                  className={`py-2 flex flex-col items-center gap-1 text-xs ${
                    active ? "text-primary font-semibold" : "text-muted-foreground"
                  }`}
                  aria-label={t.label}
                  data-testid={`pos-tab-${t.path.replace(/\//g, "-")}`}
                >
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  {t.label}
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
