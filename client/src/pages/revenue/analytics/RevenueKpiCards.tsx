// 📊 營收分析 — KPI 卡（含環比）
//
// 依 dataviz 規則：數值與標籤一律用文字 token，不塗系列色；
// 漲跌用 status 色「加上」箭頭圖示與文字，不靠顏色單獨表意。
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { money, percent, type SummaryResponse } from "./useRevenueAnalytics";

interface Props {
  data: SummaryResponse | undefined;
  isLoading: boolean;
}

export default function RevenueKpiCards({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-5 space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const growth = data?.previous?.growth.netCents ?? null;
  const txGrowth = data?.previous?.growth.txCount ?? null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="淨收入"
        value={money(data?.netCents ?? 0)}
        hint={`區間 ${data?.range.days ?? 0} 天`}
        delta={growth}
        emphasis
        testId="kpi-net"
      />
      <KpiCard
        label="總收款"
        value={money(data?.grossCents ?? 0)}
        hint={`退款 ${money(data?.refundCents ?? 0)}（${(data?.refundRate ?? 0).toFixed(1)}%）`}
        testId="kpi-gross"
      />
      <KpiCard
        label="交易筆數"
        value={`${(data?.txCount ?? 0).toLocaleString("zh-TW")} 筆`}
        hint="POS + 遊戲 + 對戰"
        delta={txGrowth}
        testId="kpi-count"
      />
      <KpiCard
        label="平均客單價"
        value={money(data?.avgTicketCents ?? 0)}
        hint="淨收入 ÷ 交易筆數"
        testId="kpi-avg"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  delta,
  emphasis,
  testId,
}: {
  label: string;
  value: string;
  hint: string;
  delta?: number | null;
  emphasis?: boolean;
  testId: string;
}) {
  return (
    <Card data-testid={testId}>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p
          className={`font-number font-bold mt-1 ${emphasis ? "text-3xl" : "text-2xl"}`}
        >
          {value}
        </p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {delta !== undefined && <DeltaBadge value={delta} />}
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/** 漲跌標記 — 圖示 + 文字 + 顏色三重編碼，不單靠顏色 */
function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" aria-hidden />
        前期無資料
      </span>
    );
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium"
      style={{ color: up ? "var(--viz-good)" : "var(--viz-refund)" }}
    >
      <Icon className="w-3 h-3" aria-hidden />
      {percent(value)}
      <span className="sr-only">{up ? "較前期成長" : "較前期下降"}</span>
    </span>
  );
}
