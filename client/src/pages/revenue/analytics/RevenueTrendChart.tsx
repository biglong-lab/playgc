// 📊 營收趨勢 — 堆疊柱（來源）+ 退款負值柱
//
// 設計約束（dataviz）：
//  · 單一 Y 軸。累計線刻意「不畫」在這裡 —— 與每期金額尺度差距太大，
//    兩個 y 軸是最典型的圖表錯誤。累計值改在 KPI 卡呈現。
//  · 堆疊層之間留 2px surface gap，最上層非零段落做 4px 圓角收邊。
//  · 3 系列 → 圖例必備；另附表格檢視（亮色模式 --viz-3 對白底僅 2.82:1，
//    依 relief 規則必須有可見數值或表格，不能只靠顏色辨識）。
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table2, BarChart3 } from "lucide-react";
import {
  money, moneyCompact, formatBucket,
  type Granularity, type TimeBucket,
} from "./useRevenueAnalytics";

const STACK_ORDER = ["posCents", "gameCents", "battleCents"] as const;
type StackKey = (typeof STACK_ORDER)[number];

const SERIES: Record<StackKey, { label: string; color: string }> = {
  posCents: { label: "現場收款", color: "var(--viz-1)" },
  gameCents: { label: "遊戲購買", color: "var(--viz-2)" },
  battleCents: { label: "對戰報名", color: "var(--viz-3)" },
};

interface ChartRow extends TimeBucket {
  refundNeg: number;
}

interface Props {
  series: TimeBucket[] | undefined;
  granularity: Granularity;
  isLoading: boolean;
}

export default function RevenueTrendChart({ series, granularity, isLoading }: Props) {
  const [showTable, setShowTable] = useState(false);

  const rows: ChartRow[] = (series ?? []).map((b) => ({ ...b, refundNeg: -b.refundCents }));
  const hasRefund = rows.some((r) => r.refundCents > 0);
  const hasAnyValue = rows.some((r) => r.netCents !== 0 || r.refundCents !== 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-base">營收趨勢</CardTitle>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowTable((v) => !v)}
          data-testid="toggle-trend-table"
        >
          {showTable ? <BarChart3 className="w-4 h-4 mr-1" /> : <Table2 className="w-4 h-4 mr-1" />}
          {showTable ? "圖表" : "表格"}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-[20rem] flex items-center justify-center text-sm text-muted-foreground">
            載入中…
          </div>
        ) : !hasAnyValue ? (
          <div className="h-[20rem] flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="w-8 h-8" aria-hidden />
            <p className="text-sm">此區間沒有任何收款紀錄</p>
          </div>
        ) : showTable ? (
          <TrendTable rows={rows} granularity={granularity} hasRefund={hasRefund} />
        ) : (
          <div className="h-[20rem]" data-testid="trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid vertical={false} stroke="var(--viz-grid)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="bucket"
                  tickFormatter={(v: string) => formatBucket(v, granularity)}
                  stroke="var(--viz-axis)"
                  tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
                  tickLine={false}
                  minTickGap={16}
                />
                <YAxis
                  tickFormatter={moneyCompact}
                  stroke="var(--viz-axis)"
                  tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }}
                  content={<TrendTooltip granularity={granularity} />}
                />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-muted-foreground">{value}</span>
                  )}
                />
                {hasRefund && <ReferenceLine y={0} stroke="var(--viz-axis)" />}
                {STACK_ORDER.map((key) => (
                  <Bar
                    key={key}
                    dataKey={key}
                    stackId="revenue"
                    name={SERIES[key].label}
                    fill={SERIES[key].color}
                    shape={<StackSegment stackKey={key} />}
                    isAnimationActive={false}
                  />
                ))}
                {hasRefund && (
                  <Bar
                    dataKey="refundNeg"
                    name="退款"
                    fill="var(--viz-refund)"
                    radius={[0, 0, 4, 4]}
                    isAnimationActive={false}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// 自訂堆疊段：只有「該柱最上面的非零段」收 4px 圓角，並留 2px 表面間隙
// ============================================================================

interface SegmentProps {
  stackKey?: StackKey;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  payload?: TimeBucket;
}

function StackSegment({ stackKey, x = 0, y = 0, width = 0, height = 0, fill, payload }: SegmentProps) {
  if (!stackKey || height <= 0 || width <= 0) return <g />;

  const above = STACK_ORDER.slice(STACK_ORDER.indexOf(stackKey) + 1);
  const isTop = !payload || above.every((k) => (payload[k] ?? 0) <= 0);
  const r = isTop ? Math.min(4, width / 2, height) : 0;

  // 2px 表面間隙：段落之間各縮 1px（最上層不縮頂端）
  const gap = height > 4 ? 1 : 0;
  const top = y + (isTop ? 0 : gap);
  const h = height - (isTop ? gap : gap * 2);
  if (h <= 0) return <g />;

  const d = r
    ? `M${x},${top + h} L${x},${top + r} Q${x},${top} ${x + r},${top} L${x + width - r},${top} Q${x + width},${top} ${x + width},${top + r} L${x + width},${top + h} Z`
    : `M${x},${top} L${x + width},${top} L${x + width},${top + h} L${x},${top + h} Z`;

  return <path d={d} fill={fill} />;
}

// ============================================================================
// Tooltip / 表格
// ============================================================================

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: Array<{ payload: ChartRow }>;
  granularity: Granularity;
}

function TrendTooltip({ active, label, payload, granularity }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-medium text-foreground">
        {label ? formatBucket(label, granularity) : ""}
      </p>
      {STACK_ORDER.filter((k) => row[k] > 0).map((k) => (
        <div key={k} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: SERIES[k].color }}
              aria-hidden
            />
            {SERIES[k].label}
          </span>
          <span className="font-number text-foreground">{money(row[k])}</span>
        </div>
      ))}
      {row.refundCents > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-sm"
              style={{ background: "var(--viz-refund)" }}
              aria-hidden
            />
            退款
          </span>
          <span className="font-number text-foreground">−{money(row.refundCents)}</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-4 border-t pt-1 mt-1">
        <span className="text-muted-foreground">淨收入</span>
        <span className="font-number font-medium text-foreground">{money(row.netCents)}</span>
      </div>
      <p className="text-muted-foreground pt-0.5">{row.txCount} 筆交易</p>
    </div>
  );
}

function TrendTable({
  rows,
  granularity,
  hasRefund,
}: {
  rows: ChartRow[];
  granularity: Granularity;
  hasRefund: boolean;
}) {
  return (
    <div className="overflow-x-auto max-h-[20rem]" data-testid="trend-table">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">期間</th>
            {STACK_ORDER.map((k) => (
              <th key={k} className="text-right py-2 px-3 font-medium whitespace-nowrap">
                {SERIES[k].label}
              </th>
            ))}
            {hasRefund && <th className="text-right py-2 px-3 font-medium">退款</th>}
            <th className="text-right py-2 pl-3 font-medium">淨收入</th>
          </tr>
        </thead>
        <tbody className="font-number">
          {rows.map((r) => (
            <tr key={r.bucket} className="border-b last:border-0">
              <td className="py-1.5 pr-3 whitespace-nowrap">{formatBucket(r.bucket, granularity)}</td>
              {STACK_ORDER.map((k) => (
                <td key={k} className="text-right py-1.5 px-3 tabular-nums">
                  {r[k] > 0 ? money(r[k]) : "—"}
                </td>
              ))}
              {hasRefund && (
                <td className="text-right py-1.5 px-3 tabular-nums">
                  {r.refundCents > 0 ? `−${money(r.refundCents)}` : "—"}
                </td>
              )}
              <td className="text-right py-1.5 pl-3 tabular-nums font-medium">{money(r.netCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
