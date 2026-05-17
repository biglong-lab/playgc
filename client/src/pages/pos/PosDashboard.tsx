// 📱 POS Dashboard（2026-05-18）
//
// 路徑：/pos
// 給現場工作人員看「今天狀況」
//   - 大字數字：今日預約 N 組 / 已到 M 組 / 已收款 NT$XXX
//   - 下個 30 分鐘要到的預約
//   - 大按鈕：掃描 QR / 收款 / 券核銷

import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import PosLayout from "./PosLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScanLine, DollarSign, Ticket, ListChecks, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

interface PosDashboard {
  date: string;
  fieldId: string;
  fieldName?: string;
  stats: {
    totalBookings: number;
    arrivedBookings: number;
    paidBookings: number;
    posTotalPaidCents: number;
    posTxCount: number;
  };
  upcoming: Array<{
    id: number;
    bookingCode: string;
    displayName: string | null;
    slotStart: string;
    partySize: number;
    activity?: { name: string; coverUrl?: string | null } | null;
  }>;
}

export default function PosDashboard() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<PosDashboard>({
    queryKey: ["pos-dashboard"],
    queryFn: async () => await fetchWithAdminAuth("/api/pos/dashboard"),
    refetchInterval: 30_000, // 每 30 秒自動刷新
  });

  if (isLoading) {
    return (
      <PosLayout title="POS 工作站">
        <div className="text-sm text-muted-foreground text-center py-8">載入中…</div>
      </PosLayout>
    );
  }

  if (error || !data) {
    return (
      <PosLayout title="POS 工作站">
        <Card>
          <CardContent className="py-8 text-center space-y-2">
            <AlertCircle className="w-10 h-10 mx-auto text-destructive" />
            <p className="text-sm">無法載入、請確認登入狀態</p>
            <Button onClick={() => navigate("/admin/login")}>前往登入</Button>
          </CardContent>
        </Card>
      </PosLayout>
    );
  }

  const s = data.stats;
  const dateLabel = new Date(data.date).toLocaleDateString("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  return (
    <PosLayout title="POS 工作站">
      <p className="text-xs text-muted-foreground mb-3">{dateLabel}</p>

      {/* 大字統計 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="今日預約" value={`${s.totalBookings}`} suffix="組" color="text-blue-600" />
        <StatCard label="已到場" value={`${s.arrivedBookings}`} suffix="組" color="text-green-600" />
        <StatCard
          label="已收款"
          value={`NT$${(s.posTotalPaidCents / 100).toLocaleString()}`}
          suffix=""
          color="text-amber-600"
        />
        <StatCard label="收款筆數" value={`${s.posTxCount}`} suffix="筆" color="text-slate-600" />
      </div>

      {/* 主要動作大按鈕 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <BigActionButton href="/pos/scan" icon={ScanLine} label="掃描 QR" color="bg-primary" />
        <BigActionButton href="/pos/checkout" icon={DollarSign} label="現金收款" color="bg-amber-600" />
        <BigActionButton href="/pos/bookings/today" icon={ListChecks} label="今日預約" color="bg-blue-600" />
        <BigActionButton href="/pos/voucher" icon={Ticket} label="券核銷" color="bg-purple-600" />
      </div>

      {/* 下個時段 */}
      <section>
        <h2 className="text-sm font-bold mb-2 flex items-center gap-1">
          <Clock className="w-4 h-4" aria-hidden="true" />
          下個 30 分鐘
        </h2>
        {data.upcoming.length === 0 ? (
          <Card>
            <CardContent className="py-4 text-center text-sm text-muted-foreground">
              暫無即將到場的預約
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {data.upcoming.map((b) => {
              const t = new Date(b.slotStart);
              const timeStr = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
              return (
                <Card key={b.id}>
                  <CardContent className="py-3 flex items-center gap-3">
                    <div className="text-lg font-bold text-primary">{timeStr}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{b.displayName || "—"}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {b.activity?.name || "預約"} · {b.partySize} 人 · {b.bookingCode}
                      </p>
                    </div>
                    <Link href="/pos/scan">
                      <Button size="sm" variant="outline">
                        報到
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </PosLayout>
  );
}

function StatCard({
  label,
  value,
  suffix,
  color,
}: {
  label: string;
  value: string;
  suffix: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="py-3 px-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${color}`}>
          {value}
          {suffix && <span className="text-xs ml-1 text-muted-foreground">{suffix}</span>}
        </p>
      </CardContent>
    </Card>
  );
}

function BigActionButton({
  href,
  icon: Icon,
  label,
  color,
}: {
  href: string;
  icon: typeof ScanLine;
  label: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <button
        className={`w-full h-20 rounded-xl ${color} text-white flex flex-col items-center justify-center gap-1 active:scale-95 transition-transform`}
      >
        <Icon className="w-7 h-7" aria-hidden="true" />
        <span className="font-bold text-sm">{label}</span>
      </button>
    </Link>
  );
}
