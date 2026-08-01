// 📊 時段熱力圖 — 星期 × 小時
//
// 用順序色（單一藍色相，淺→深）表示金額大小，符合 dataviz 對
// sequential 編碼的規定：絕不用彩虹色，絕不用類別色來表示連續量。
// 每格都有原生 title 與 aria-label，顏色不是唯一的資訊來源。
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";
import { money, useRevenueHeatmap, type DateRange, type HeatCell } from "./useRevenueAnalytics";

const DOW_LABEL = ["日", "一", "二", "三", "四", "五", "六"] as const;
/** 沒有資料時的預設顯示範圍（一般營業時段）*/
const FALLBACK_HOURS = { start: 8, end: 22 };
const SEQ_STEPS = 6;

interface Props {
  range: DateRange;
  enabled: boolean;
}

export default function RevenueHeatmap({ range, enabled }: Props) {
  const { data, isLoading } = useRevenueHeatmap(range, enabled);

  const cells = data?.cells ?? [];
  const maxCents = data?.maxCents ?? 0;
  const active = cells.filter((c) => c.cents > 0);

  // 只顯示有交易的時段範圍，避免整夜空白把格子壓扁
  const startHour = active.length
    ? Math.min(FALLBACK_HOURS.start, ...active.map((c) => c.hour))
    : FALLBACK_HOURS.start;
  const endHour = active.length
    ? Math.max(FALLBACK_HOURS.end, ...active.map((c) => c.hour))
    : FALLBACK_HOURS.end;
  const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => startHour + i);

  const byKey = new Map(cells.map((c) => [`${c.dow}-${c.hour}`, c]));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="w-4 h-4" aria-hidden />
          時段熱力圖
        </CardTitle>
        {data?.peak && (
          <p className="text-xs text-muted-foreground">
            尖峰：週{DOW_LABEL[data.peak.dow]} {String(data.peak.hour).padStart(2, "0")}:00
            （{money(maxCents)}）
          </p>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            載入中…
          </div>
        ) : maxCents === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <CalendarClock className="w-8 h-8" aria-hidden />
            <p className="text-sm">此區間沒有可分析的時段資料</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto pb-1" data-testid="heatmap-grid">
              <div className="min-w-max">
                {/* 小時標頭 */}
                <div className="flex gap-[2px] mb-[2px] pl-7">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="w-6 text-center text-[10px] text-muted-foreground tabular-nums"
                    >
                      {h % 2 === 0 ? String(h).padStart(2, "0") : ""}
                    </div>
                  ))}
                </div>
                {DOW_LABEL.map((label, dow) => (
                  <div key={dow} className="flex gap-[2px] mb-[2px] items-center">
                    <div className="w-7 text-[11px] text-muted-foreground shrink-0">週{label}</div>
                    {hours.map((h) => (
                      <HeatSquare
                        key={h}
                        cell={byKey.get(`${dow}-${h}`)}
                        dowLabel={label}
                        hour={h}
                        maxCents={maxCents}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <ScaleLegend maxCents={maxCents} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** 金額 → 順序色階（0 = 空格，與 surface 同色）*/
function stepOf(cents: number, maxCents: number): number {
  if (cents <= 0 || maxCents <= 0) return 0;
  return Math.max(1, Math.ceil((cents / maxCents) * SEQ_STEPS));
}

function HeatSquare({
  cell,
  dowLabel,
  hour,
  maxCents,
}: {
  cell: HeatCell | undefined;
  dowLabel: string;
  hour: number;
  maxCents: number;
}) {
  const cents = cell?.cents ?? 0;
  const step = stepOf(cents, maxCents);
  const hh = `${String(hour).padStart(2, "0")}:00`;
  const desc =
    cents > 0
      ? `週${dowLabel} ${hh}：${money(cents)}（${cell?.count ?? 0} 筆）`
      : `週${dowLabel} ${hh}：無交易`;

  return (
    <div
      className="w-6 h-6 rounded-sm shrink-0 border border-border/40"
      style={{ background: `var(--viz-seq-${step})` }}
      title={desc}
      aria-label={desc}
      role="img"
    />
  );
}

function ScaleLegend({ maxCents }: { maxCents: number }) {
  return (
    <div className="flex items-center gap-2 mt-3 text-[11px] text-muted-foreground">
      <span>少</span>
      <div className="flex gap-[2px]">
        {Array.from({ length: SEQ_STEPS + 1 }, (_, i) => (
          <div
            key={i}
            className="w-4 h-3 rounded-sm border border-border/40"
            style={{ background: `var(--viz-seq-${i})` }}
            aria-hidden
          />
        ))}
      </div>
      <span>多</span>
      <span className="ml-1 tabular-nums">（最高 {money(maxCents)}）</span>
    </div>
  );
}
