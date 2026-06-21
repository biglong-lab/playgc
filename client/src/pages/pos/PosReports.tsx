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
import { useAdminAuth } from "@/hooks/useAdminAuth";

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
  byMethod?: Array<{ label: string; cents: number; count: number }>;
  byCategory?: Array<{ label: string; cents: number; qty: number }>;
  byProduct?: Array<{ name: string; qty: number; cents: number }>;
}
interface CashSummary {
  date: string;
  openingCents: number | null;
  closingCents: number | null;
  cashSalesCents: number;
  cashRefundsCents: number;
  drawdownCents: number;
  actualCashCents: number | null;
}
interface Status {
  bookings: { today: number; month: number; future: number; srcLineDirect: number; srcManual: number; srcManualLinked: number };
  refundsThisMonth: { count: number; cents: number };
}

export default function PosReports() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { hasPermission } = useAdminAuth({ redirectTo: "" });
  const canCashAdmin = hasPermission("pos_cash_admin");
  const [date, setDate] = useState(taipeiToday());
  const [range, setRange] = useState<{ from: string; to: string; label: string } | null>(null);

  const { data: cash } = useQuery<CashSummary>({
    queryKey: ["pos-cash-summary", date],
    queryFn: () => fetchWithAdminAuth(`/api/pos/cash/summary?date=${date}`),
    enabled: canCashAdmin,
  });

  const { data: rangeRep } = useQuery<RangeRep>({
    queryKey: ["pos-range-report", range?.from, range?.to],
    queryFn: () => fetchWithAdminAuth(`/api/admin/pos/reports/range?from=${range!.from}&to=${range!.to}`),
    enabled: !!range,
  });

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

  if (!canCashAdmin) {
    return (
      <PosLayout title="銷售報表" backTo="/pos">
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-base font-medium">🔒 權限不足</p>
          <p className="text-sm mt-2">銷售報表僅限管理員（pos_cash_admin）查看，請聯絡平台管理員開通。</p>
        </div>
      </PosLayout>
    );
  }

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

        {/* 💰 櫃檯現金（當日）*/}
        {cash && (cash.openingCents !== null || cash.closingCents !== null || cash.drawdownCents > 0) && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">櫃檯現金</CardTitle></CardHeader>
            <CardContent className="py-2 px-3">
              <Row label="開班清點" value={cash.openingCents !== null ? money(cash.openingCents) : "—"} />
              <Row label="現金收款 / 退款" value={`${money(cash.cashSalesCents)} / ${money(cash.cashRefundsCents)}`} />
              <Row label="下班結算" value={cash.closingCents !== null ? money(cash.closingCents) : "—"} />
              <Row label="清帳取走" value={cash.drawdownCents > 0 ? `−${money(cash.drawdownCents)}` : "—"} />
              <Row label="櫃檯實際現金" value={cash.actualCashCents !== null ? money(cash.actualCashCents) : "—"} />
            </CardContent>
          </Card>
        )}

        {/* 🆕 週/月 區間 */}
        <Card>
          <CardHeader className="py-3"><CardTitle className="text-base">區間統計</CardTitle></CardHeader>
          <CardContent className="py-2 px-3 space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                const now = new Date();
                const day = (now.getDay() + 6) % 7; // 週一為起點
                const mon = new Date(now); mon.setDate(now.getDate() - day);
                const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                setRange({ from: fmt(mon), to: taipeiToday(), label: "本週" });
              }} data-testid="range-week">本週</Button>
              <Button size="sm" variant="outline" onClick={() => {
                const now = new Date();
                const first = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`;
                setRange({ from: first, to: taipeiToday(), label: "本月" });
              }} data-testid="range-month">本月</Button>
              {range && <Button size="sm" variant="ghost" onClick={() => setRange(null)}>清除</Button>}
            </div>
            {range && rangeRep && (
              <div className="text-sm space-y-1">
                <div className="font-medium">{range.label}（{rangeRep.fromDate} ~ {rangeRep.toDate}）</div>
                <Row label="淨收款" value={money(rangeRep.netCents)} />
                <Row label="總收 / 退款" value={`${money(rangeRep.totalCents)} / ${money(rangeRep.refundsCents)}`} />
                <Row label="交易筆數" value={`${rangeRep.txnCount} 筆`} />
                <div className="pt-1 text-xs text-muted-foreground">每日：{rangeRep.daily.map((d) => `${d.day.slice(5)} ${money(d.cents)}`).join("　")}</div>
                {/* drill-down：區間分類 / 付款 / 熱銷 */}
                {rangeRep.byCategory && rangeRep.byCategory.length > 0 && (
                  <div className="pt-2 mt-1 border-t">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">區間分類</div>
                    {rangeRep.byCategory.map((c) => <Row key={c.label} label={`${c.label}（${c.qty} 件）`} value={money(c.cents)} />)}
                  </div>
                )}
                {rangeRep.byMethod && rangeRep.byMethod.length > 0 && (
                  <div className="pt-2 mt-1 border-t">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">區間付款方式</div>
                    {rangeRep.byMethod.map((m) => <Row key={m.label} label={`${m.label}（${m.count} 筆）`} value={money(m.cents)} />)}
                  </div>
                )}
                {rangeRep.byProduct && rangeRep.byProduct.length > 0 && (
                  <div className="pt-2 mt-1 border-t">
                    <div className="text-xs font-semibold text-muted-foreground mb-1">區間熱銷 TOP10</div>
                    {rangeRep.byProduct.slice(0, 10).map((p) => <Row key={p.name} label={`${p.name} ×${p.qty}`} value={money(p.cents)} />)}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 時段分析 */}
        {daily?.byHour && daily.byHour.length > 0 && (
          <Card>
            <CardHeader className="py-3"><CardTitle className="text-base">時段分析</CardTitle></CardHeader>
            <CardContent className="py-2 px-3">
              {daily.byHour.map((h) => (
                <Row key={h.hour} label={`${String(h.hour).padStart(2, "0")}:00（${h.count} 筆）`} value={money(h.cents)} />
              ))}
            </CardContent>
          </Card>
        )}

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
