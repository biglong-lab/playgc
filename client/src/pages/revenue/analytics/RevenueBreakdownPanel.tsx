// 📊 營收維度排行 — 單色橫條
//
// 為什麼是單色：經 validate_palette 驗證，本專案類別色只有 3 槽能通過
// all-pairs CVD 門檻。維度動輒 10+ 項，多色會有無法辨識的相鄰對，
// 因此一律單色 + 軸標籤區分 + 條末直接標數值（單一系列不需圖例）。
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, LabelList, ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table2, BarChart3, PieChart } from "lucide-react";
import {
  money, moneyCompact, useRevenueBreakdown,
  type BreakdownDimension, type BreakdownRow, type DateRange,
} from "./useRevenueAnalytics";

const DIMENSIONS: ReadonlyArray<{ key: BreakdownDimension; label: string; unit: string }> = [
  { key: "pos_product", label: "品項", unit: "件" },
  { key: "pos_category", label: "分類", unit: "件" },
  { key: "activity", label: "活動", unit: "筆" },
  { key: "method", label: "付款", unit: "筆" },
  { key: "catalog", label: "遊戲/場地", unit: "筆" },
  { key: "pos_modifier", label: "客製", unit: "份" },
  { key: "source", label: "來源", unit: "筆" },
];

interface Props {
  range: DateRange;
  enabled: boolean;
}

export default function RevenueBreakdownPanel({ range, enabled }: Props) {
  const [dimension, setDimension] = useState<BreakdownDimension>("pos_product");
  const [showTable, setShowTable] = useState(false);
  const { data, isLoading } = useRevenueBreakdown(range, dimension, enabled);

  const rows = data?.rows ?? [];
  const unit = DIMENSIONS.find((d) => d.key === dimension)?.unit ?? "筆";
  // 橫條圖高度隨項目數長，避免項目多時標籤擠在一起
  const chartHeight = Math.max(200, rows.length * 34 + 40);

  return (
    <Card>
      <CardHeader className="space-y-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">項目排行</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowTable((v) => !v)}
            data-testid="toggle-breakdown-table"
          >
            {showTable ? <BarChart3 className="w-4 h-4 mr-1" /> : <Table2 className="w-4 h-4 mr-1" />}
            {showTable ? "圖表" : "表格"}
          </Button>
        </div>
        <Tabs value={dimension} onValueChange={(v) => setDimension(v as BreakdownDimension)}>
          <TabsList className="flex-wrap h-auto">
            {DIMENSIONS.map((d) => (
              <TabsTrigger key={d.key} value={d.key} data-testid={`dim-${d.key}`}>
                {d.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
            載入中…
          </div>
        ) : rows.length === 0 ? (
          <div className="h-52 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <PieChart className="w-8 h-8" aria-hidden />
            <p className="text-sm">此區間沒有可分析的項目</p>
          </div>
        ) : showTable ? (
          <BreakdownTable rows={rows} unit={unit} />
        ) : (
          <div style={{ height: chartHeight }} data-testid="breakdown-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={rows}
                layout="vertical"
                margin={{ top: 4, right: 72, bottom: 4, left: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--viz-grid)" strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={moneyCompact}
                  stroke="var(--viz-axis)"
                  tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={128}
                  stroke="var(--viz-axis)"
                  tick={{ fill: "var(--viz-muted)", fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "var(--viz-grid)", opacity: 0.35 }}
                  content={<BreakdownTooltip unit={unit} />}
                />
                <Bar
                  dataKey="cents"
                  fill="var(--viz-1)"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                  isAnimationActive={false}
                >
                  {/* width 必填：不給的話 recharts 會拿「長條本身的長度」當
                      換行寬度，最短的那條會把「NT$ 4,410」折成兩行 */}
                  <LabelList
                    dataKey="cents"
                    position="right"
                    width={96}
                    formatter={(v: number) => money(v)}
                    className="fill-muted-foreground"
                    fontSize={11}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BreakdownTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean;
  payload?: Array<{ payload: BreakdownRow }>;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs space-y-1">
      <p className="font-medium text-foreground">{row.label}</p>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">金額</span>
        <span className="font-number text-foreground">{money(row.cents)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">佔比</span>
        <span className="font-number text-foreground">{row.share}%</span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-muted-foreground">{row.qty !== undefined ? "數量" : "筆數"}</span>
        <span className="font-number text-foreground">
          {row.qty !== undefined ? `${row.qty} ${unit}` : `${row.count} 筆`}
        </span>
      </div>
    </div>
  );
}

function BreakdownTable({ rows, unit }: { rows: BreakdownRow[]; unit: string }) {
  return (
    <div className="overflow-x-auto max-h-[26rem]" data-testid="breakdown-table">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr className="border-b text-xs text-muted-foreground">
            <th className="text-left py-2 pr-3 font-medium">項目</th>
            <th className="text-right py-2 px-3 font-medium">金額</th>
            <th className="text-right py-2 px-3 font-medium">佔比</th>
            <th className="text-right py-2 pl-3 font-medium">
              {rows.some((r) => r.qty !== undefined) ? "數量" : "筆數"}
            </th>
          </tr>
        </thead>
        <tbody className="font-number">
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0">
              <td className="py-1.5 pr-3">{r.label}</td>
              <td className="text-right py-1.5 px-3 tabular-nums">{money(r.cents)}</td>
              <td className="text-right py-1.5 px-3 tabular-nums">{r.share}%</td>
              <td className="text-right py-1.5 pl-3 tabular-nums">
                {r.qty !== undefined ? `${r.qty} ${unit}` : `${r.count} 筆`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
