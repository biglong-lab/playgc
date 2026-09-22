// 📊 POS 區間統計卡片（2026-09-22 從 PosReports 抽出）
// 快捷：本週 / 本月 / 上個月；自訂起訖（起 > 訖 前端擋下不送出）
// 呼叫 GET /api/admin/pos/reports/range?from=&to=（後端同樣驗證、最長 366 天）

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAdminAuth } from "@/pages/admin-staff/types";
import { ReportRow as Row, money } from "./pos-report-ui";
import {
  thisWeek,
  thisMonth,
  lastMonth,
  validateCustomRange,
  formatRangeTitle,
  type DateRange,
  type LabeledRange,
} from "./pos-report-ranges";

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

interface BreakdownRow {
  key: string;
  label: string;
  value: string;
}

/** 每日明細超過此天數就不逐日列出（區間可達一年，整排文字會洗版） */
const MAX_DAILY_LIST = 62;

const PRESETS: ReadonlyArray<{ label: string; testId: string; build: () => DateRange }> = [
  { label: "本週", testId: "range-week", build: () => thisWeek() },
  { label: "本月", testId: "range-month", build: () => thisMonth() },
  { label: "上個月", testId: "range-last-month", build: () => lastMonth() },
];

function Breakdown({ title, rows }: { title: string; rows: BreakdownRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="pt-2 mt-1 border-t">
      <div className="text-xs font-semibold text-muted-foreground mb-1">{title}</div>
      {rows.map((r) => <Row key={r.key} label={r.label} value={r.value} />)}
    </div>
  );
}

function DailyLine({ daily }: { daily: RangeRep["daily"] }) {
  const text = daily.length > MAX_DAILY_LIST
    ? `共 ${daily.length} 天有交易（區間較長，不逐日列出）`
    : daily.map((d) => `${d.day.slice(5)} ${money(d.cents)}`).join("　");
  return <div className="pt-1 text-xs text-muted-foreground">每日：{text}</div>;
}

/** 區間結果：總額 + 每日 + drill-down（分類 / 付款 / 熱銷） */
function RangeResult({ report }: { report: RangeRep }) {
  const categories = (report.byCategory ?? []).map((c) => ({ key: c.label, label: `${c.label}（${c.qty} 件）`, value: money(c.cents) }));
  const methods = (report.byMethod ?? []).map((m) => ({ key: m.label, label: `${m.label}（${m.count} 筆）`, value: money(m.cents) }));
  const products = (report.byProduct ?? []).slice(0, 10).map((p) => ({ key: p.name, label: `${p.name} ×${p.qty}`, value: money(p.cents) }));
  return (
    <>
      <Row label="淨收款" value={money(report.netCents)} />
      <Row label="總收 / 退款" value={`${money(report.totalCents)} / ${money(report.refundsCents)}`} />
      <Row label="交易筆數" value={`${report.txnCount} 筆`} />
      <DailyLine daily={report.daily} />
      <Breakdown title="區間分類" rows={categories} />
      <Breakdown title="區間付款方式" rows={methods} />
      <Breakdown title="區間熱銷 TOP10" rows={products} />
    </>
  );
}

interface CustomRangeFormProps {
  value: DateRange;
  error: string | null;
  onChange: (next: DateRange) => void;
  onSubmit: () => void;
}

/** 自訂起訖：兩個日期欄 + 查詢；錯誤訊息顯示在下方 */
function CustomRangeForm({ value, error, onChange, onSubmit }: CustomRangeFormProps) {
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" aria-label="自訂起始日" className="h-9 flex-1 min-w-[9rem]" value={value.from}
          onChange={(e) => onChange({ ...value, from: e.target.value })} data-testid="range-custom-from" />
        <span className="text-muted-foreground">~</span>
        <Input type="date" aria-label="自訂結束日" className="h-9 flex-1 min-w-[9rem]" value={value.to}
          onChange={(e) => onChange({ ...value, to: e.target.value })} data-testid="range-custom-to" />
        <Button size="sm" onClick={onSubmit} data-testid="range-custom-submit">查詢</Button>
      </div>
      {error && <p role="alert" className="text-xs text-destructive" data-testid="range-custom-error">{error}</p>}
    </div>
  );
}

export default function PosRangeReport() {
  const [range, setRange] = useState<LabeledRange | null>(null);
  const [custom, setCustom] = useState<DateRange>({ from: "", to: "" });
  const [customError, setCustomError] = useState<string | null>(null);

  const { data: report, isLoading, error } = useQuery<RangeRep>({
    queryKey: ["pos-range-report", range?.from, range?.to],
    queryFn: () => fetchWithAdminAuth(`/api/admin/pos/reports/range?from=${range!.from}&to=${range!.to}`),
    enabled: !!range,
  });

  /** 選快捷 / 清除（null）：一併清掉自訂錯誤訊息 */
  const pick = (next: LabeledRange | null) => {
    setCustomError(null);
    setRange(next);
  };
  const submitCustom = () => {
    const err = validateCustomRange(custom.from, custom.to);
    setCustomError(err);
    if (!err) setRange({ label: "自訂", ...custom });
  };

  return (
    <Card>
      <CardHeader className="py-3"><CardTitle className="text-base">區間統計</CardTitle></CardHeader>
      <CardContent className="py-2 px-3 space-y-2">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.testId} size="sm" variant="outline" onClick={() => pick({ label: p.label, ...p.build() })}
              data-testid={p.testId}>{p.label}</Button>
          ))}
          {range && <Button size="sm" variant="ghost" onClick={() => pick(null)}>清除</Button>}
        </div>
        <CustomRangeForm value={custom} error={customError} onChange={setCustom} onSubmit={submitCustom} />
        {range && (
          <div className="text-sm space-y-1">
            <div className="font-medium" data-testid="range-title">{formatRangeTitle(range)}</div>
            {isLoading && <p className="text-xs text-muted-foreground">載入中…</p>}
            {error && <p className="text-xs text-destructive">{error instanceof Error ? error.message : "查詢失敗"}</p>}
            {report && <RangeResult report={report} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
