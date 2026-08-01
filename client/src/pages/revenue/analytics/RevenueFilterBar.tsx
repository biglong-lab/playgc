// 📊 營收分析 — 篩選列（受控元件，狀態由主容器持有並同步到 URL）
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarRange } from "lucide-react";
import {
  RANGE_PRESETS,
  type DateRange,
  type Granularity,
} from "./useRevenueAnalytics";

interface Props {
  range: DateRange;
  granularity: Granularity;
  activePreset: string | null;
  onPreset: (key: string) => void;
  onRangeChange: (range: DateRange) => void;
  onGranularityChange: (g: Granularity) => void;
}

export default function RevenueFilterBar({
  range,
  granularity,
  activePreset,
  onPreset,
  onRangeChange,
  onGranularityChange,
}: Props) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* 快捷區間 */}
        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((p) => (
            <Button
              key={p.key}
              size="sm"
              variant={activePreset === p.key ? "default" : "outline"}
              onClick={() => onPreset(p.key)}
              data-testid={`range-${p.key}`}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* 自訂區間 + 粒度 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-muted-foreground shrink-0" />
            <Input
              type="date"
              value={range.from}
              max={range.to}
              className="w-[9.5rem]"
              onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
              data-testid="range-from"
              aria-label="起始日期"
            />
            <span className="text-muted-foreground text-sm">→</span>
            <Input
              type="date"
              value={range.to}
              min={range.from}
              className="w-[9.5rem]"
              onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
              data-testid="range-to"
              aria-label="結束日期"
            />
          </div>

          <Tabs
            value={granularity}
            onValueChange={(v) => onGranularityChange(v as Granularity)}
            className="ml-auto"
          >
            <TabsList>
              <TabsTrigger value="day" data-testid="granularity-day">日</TabsTrigger>
              <TabsTrigger value="week" data-testid="granularity-week">週</TabsTrigger>
              <TabsTrigger value="month" data-testid="granularity-month">月</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardContent>
    </Card>
  );
}
