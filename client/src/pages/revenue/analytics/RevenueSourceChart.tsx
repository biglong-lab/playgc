// 📊 收入來源占比 — 甜甜圈
//
// 恰好 3 個來源，正是本專案類別色板通過 all-pairs CVD 驗證的槽數上限。
// 每片都直接標示名稱與金額，顏色不是唯一的識別方式。
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, type SummaryResponse, type RevenueSource } from "./useRevenueAnalytics";

const SOURCE_META: Record<RevenueSource, { label: string; color: string }> = {
  pos: { label: "現場收款", color: "var(--viz-1)" },
  game: { label: "遊戲購買", color: "var(--viz-2)" },
  battle: { label: "對戰報名", color: "var(--viz-3)" },
};

interface Slice {
  key: RevenueSource;
  label: string;
  color: string;
  cents: number;
  share: number;
}

export default function RevenueSourceChart({
  data,
  isLoading,
}: {
  data: SummaryResponse | undefined;
  isLoading: boolean;
}) {
  const total = data?.netCents ?? 0;
  const slices: Slice[] = data
    ? (Object.keys(SOURCE_META) as RevenueSource[])
        .map((key) => ({
          key,
          label: SOURCE_META[key].label,
          color: SOURCE_META[key].color,
          cents: data.bySource[key]?.netCents ?? 0,
          share: total > 0 ? Math.round(((data.bySource[key]?.netCents ?? 0) / total) * 1000) / 10 : 0,
        }))
        .filter((s) => s.cents > 0)
    : [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">收入來源占比</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            載入中…
          </div>
        ) : slices.length === 0 ? (
          <div className="h-56 flex items-center justify-center text-sm text-muted-foreground">
            此區間沒有收入紀錄
          </div>
        ) : (
          // 這張卡在桌機只佔 1/3 欄寬（約 300px），若橫排會把圖例壓成
          // 直排單字（「現/場/收/款」）。一律縱向：甜甜圈在上、標籤在下。
          <div className="flex flex-col items-center gap-4">
            <div className="h-44 w-44 shrink-0 relative" data-testid="source-donut">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="cents"
                    nameKey="label"
                    innerRadius="62%"
                    outerRadius="92%"
                    paddingAngle={2}
                    stroke="hsl(var(--card))"
                    strokeWidth={2}
                    isAnimationActive={false}
                  >
                    {slices.map((s) => (
                      <Cell key={s.key} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<SourceTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] text-muted-foreground">淨收入</span>
                <span className="font-number font-bold text-sm">{money(total)}</span>
              </div>
            </div>

            {/* 圖例即直接標籤：名稱 + 金額 + 佔比，不靠顏色單獨表意 */}
            <ul className="w-full space-y-2">
              {slices.map((s) => (
                <li key={s.key} className="flex items-center gap-2 text-sm">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  <span className="text-muted-foreground flex-1">{s.label}</span>
                  <span className="font-number tabular-nums">{money(s.cents)}</span>
                  <span className="font-number tabular-nums text-muted-foreground w-12 text-right">
                    {s.share}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: Slice }>;
}) {
  if (!active || !payload?.length) return null;
  const s = payload[0].payload;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md text-xs">
      <p className="font-medium text-foreground">{s.label}</p>
      <p className="font-number text-muted-foreground mt-0.5">
        {money(s.cents)}（{s.share}%）
      </p>
    </div>
  );
}
