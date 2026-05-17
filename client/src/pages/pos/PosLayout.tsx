// 📱 POS 工作站 layout（2026-05-18）
//
// 給現場工作人員、mobile-first（不是 admin 完整後台）
// 簡潔大字、底部固定導航

import { Link, useLocation } from "wouter";
import { ReactNode, useEffect, useState } from "react";
import { Home, ScanLine, ListChecks, DollarSign, Ticket, TrendingUp, Settings, WifiOff } from "lucide-react";

interface PosLayoutProps {
  title: string;
  children: ReactNode;
  backTo?: string;
}

export default function PosLayout({ title, children, backTo }: PosLayoutProps) {
  const [location] = useLocation();

  const tabs = [
    { path: "/pos", label: "首頁", icon: Home },
    { path: "/pos/scan", label: "掃描", icon: ScanLine },
    { path: "/pos/bookings/today", label: "今日", icon: ListChecks },
    { path: "/pos/checkout", label: "收款", icon: DollarSign },
    { path: "/pos/voucher", label: "券", icon: Ticket },
    { path: "/pos/summary", label: "小結", icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
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
