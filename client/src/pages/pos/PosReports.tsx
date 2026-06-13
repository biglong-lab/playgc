// 📊 POS 報表 + 每日結帳（2026-06-13）
// 路徑：/admin/pos-reports
// 每日銷售報表（分類/付款/品項/客製）+ 狀態總覽（預約/退款）+ 每日結帳→推群組

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import PosLayout from "./PosLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";

const money = (c: number) => `NT$${(c / 100).toLocaleString()}`;
function taipeiToday() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

interface Daily {
  date: string;
  totalCents: number;
  refundsCents: number;
  netCents: number;
  refundCount: number;
  txnCount: number;
  itemCount: number;
  byMethod: Array<{ label: string; cents: number; count: number }>;
  byCategory: Array<{ label: string; cents: number; qty: number }>;
  byProduct: Array<{ name: string; qty: number; cents: number }>;
  byModifier: Array<{ name: string; qty: number }>;
  byHour: Array<{ hour: number; cents: number; count: number }>;
}
interface RangeRep {
  fromDate: string;
  toDate: string;
  totalCents: number;
  refundsCents: number;
  netCents: number;
  txnCount: number;
  daily: Array<{ day: string; cents: number }>;
}
interface Status {
  bookings: { today: number; month: number; future: number; srcLineDirect: number; srcManual: number; srcManualLinked: number };
  refundsThisMonth: { count: number; cents: number };
}

export default function PosReports() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(taipeiToday());

  const { data: daily } = useQuery<Daily>({
    queryKey: ["pos-daily-report", date],
    queryFn: () => fetchWithAdminAuth(`/api/admin/pos/reports/daily?date=${date}`),
  });
  const { data: status } = useQuery<Status>({
    queryKey: ["pos-status-report"],
    queryFn: () => fetchWithAdminAuth("/api/admin/pos/reports/status"),
  });

  const closeShift = useMutation({
    mutationFn: () => fetchWithAdminAuth("/api/pos/shift/close", { method: "POST", body: JSON.stringify({}) }),
    onSuccess: (r: { report?: Daily }) => {
      toast({ title: "✅ 已結帳並推送群組", description: `總收款 ${money(r.report?.totalCents ?? 0)}` });
      qc.invalidateQueries({ queryKey: ["pos-daily-report"] });
    },
    onError: (e) => toast({ title: "結帳失敗", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="flex justify-between text-sm py-1 border-b last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );

  return (
    <PosLayout title="銷售報表" backTo="/pos">
      <div className="space-y-3">
        {/* 日期 + 總額 */}
        <Card>
          <CardContent className="py-3 px-3 space-y-2">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="report-date" />
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg p-4 text-center">
              <div className="text-xs">{date} 淨收款（已扣退款）</div>
              <div className="text-3xl font-bold">{money(daily?.netCents ?? 0)}</div>
              <div className="text-xs">
                收 {money(daily?.totalCents ?? 0)}
                {(daily?.refundsCents ?? 0) > 0 ? ` · 退 ${money(daily!.refundsCents)}（${daily!.refundCount} 筆）` : ""}
                {" · "}{daily?.txnCount ?? 0} 筆 · {daily?.itemCount ?? 0} 件
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 分類 */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">按分類</CardTitle></CardHeader>
          <CardContent className="py-2 px-3">
            {daily?.byCategory.length ? daily.byCategory.map((c) => (
              <Row key={c.label} label={`${c.label}（${c.qty} 件）`} value={money(c.cents)} />
            )) : <p className="text-sm text-muted-foreground">無</p>}
          </CardContent>
        </Card>

        {/* 付款方式 */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">按付款方式</CardTitle></CardHeader>
          <CardContent className="py-2 px-3">
            {daily?.byMethod.length ? daily.byMethod.map((m) => (
              <Row key={m.label} label={`${m.label}（${m.count} 筆）`} value={money(m.cents)} />
            )) : <p className="text-sm text-muted-foreground">無</p>}
          </CardContent>
        </Card>

        {/* 熱銷品項 */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">熱銷品項</CardTitle></CardHeader>
          <CardContent className="py-2 px-3">
            {daily?.byProduct.length ? daily.byProduct.slice(0, 15).map((p) => (
              <Row key={p.name} label={`${p.name} ×${p.qty}`} value={money(p.cents)} />
            )) : <p className="text-sm text-muted-foreground">無</p>}
          </CardContent>
        </Card>

        {/* 客製熱度 */}
        {daily?.byModifier && daily.byModifier.length > 0 && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">客製熱度</CardTitle></CardHeader>
            <CardContent className="py-2 px-3">
              {daily.byModifier.slice(0, 12).map((m) => (
                <Row key={m.name} label={m.name} value={`×${m.qty}`} />
              ))}
            </CardContent>
          </Card>
        )}

        {/* 狀態總覽 */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">預約 / 退款狀態</CardTitle></CardHeader>
          <CardContent className="py-2 px-3">
            <Row label="今日預約" value={`${status?.bookings.today ?? 0} 組`} />
            <Row label="本月預約" value={`${status?.bookings.month ?? 0} 組`} />
            <Row label="未來預約" value={`${status?.bookings.future ?? 0} 組`} />
            <Row label="來源：LINE直訂 / 手動 / 手動已綁" value={`${status?.bookings.srcLineDirect ?? 0} / ${status?.bookings.srcManual ?? 0} / ${status?.bookings.srcManualLinked ?? 0}`} />
            <Row label="本月退款" value={`${status?.refundsThisMonth.count ?? 0} 筆 · ${money(status?.refundsThisMonth.cents ?? 0)}`} />
          </CardContent>
        </Card>

        {/* 每日結帳 */}
        <Button
          className="w-full h-14 text-lg bg-emerald-600 hover:bg-emerald-700"
          onClick={() => confirm(`確定結帳 ${taipeiToday()}？將推送結帳報表到群組`) && closeShift.mutate()}
          disabled={closeShift.isPending}
          data-testid="btn-shift-close"
        >
          {closeShift.isPending ? "結帳中…" : "🧾 今日結帳並推送群組"}
        </Button>
      </div>
    </PosLayout>
  );
}
