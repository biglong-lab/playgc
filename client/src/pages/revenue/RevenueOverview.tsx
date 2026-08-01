// 💰 財務中心 — 營收總覽 / 分析
//
// 統合 3 個金流源（現場收款 POS / 遊戲購買 / 對戰報名）的營收分析。
// 金額全程以「分」在前後端傳遞，只有 useRevenueAnalytics 的 money() 會換算成元。
//
// ⚠️ 預約（bookings）不是獨立收入源：POS 收預約款時會雙寫 bookings，
//    列入會重複計算。預約以 POS 交易的 bookingId 當維度切分。
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, Ticket, Receipt, DollarSign } from "lucide-react";
import RevenueFilterBar from "./analytics/RevenueFilterBar";
import RevenueKpiCards from "./analytics/RevenueKpiCards";
import RevenueTrendChart from "./analytics/RevenueTrendChart";
import RevenueSourceChart from "./analytics/RevenueSourceChart";
import RevenueBreakdownPanel from "./analytics/RevenueBreakdownPanel";
import RevenueHeatmap from "./analytics/RevenueHeatmap";
import RevenueTransactionsPanel from "./analytics/RevenueTransactionsPanel";
import {
  RANGE_PRESETS,
  suggestGranularity,
  useRevenueSummary,
  useRevenueTimeseries,
  type DateRange,
  type Granularity,
} from "./analytics/useRevenueAnalytics";

const DEFAULT_PRESET = "30d";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface FilterState {
  range: DateRange;
  granularity: Granularity;
  preset: string | null;
}

/** 從 URL 還原篩選條件，讓分析結果可以直接複製連結分享 */
function readInitialState(): FilterState {
  const fallback = RANGE_PRESETS.find((p) => p.key === DEFAULT_PRESET)!;
  if (typeof window === "undefined") {
    const range = fallback.build();
    return { range, granularity: suggestGranularity(range), preset: DEFAULT_PRESET };
  }

  const q = new URLSearchParams(window.location.search);
  const from = q.get("from");
  const to = q.get("to");
  const g = q.get("g");
  const validGranularity = g === "day" || g === "week" || g === "month" ? g : null;

  if (from && to && DATE_PATTERN.test(from) && DATE_PATTERN.test(to) && from <= to) {
    const range = { from, to };
    const preset = RANGE_PRESETS.find((p) => {
      const built = p.build();
      return built.from === from && built.to === to;
    });
    return {
      range,
      granularity: validGranularity ?? suggestGranularity(range),
      preset: preset?.key ?? null,
    };
  }

  const range = fallback.build();
  return {
    range,
    granularity: validGranularity ?? suggestGranularity(range),
    preset: DEFAULT_PRESET,
  };
}

export default function RevenueOverview() {
  const { isAuthenticated } = useAdminAuth();
  const [state, setState] = useState<FilterState>(readInitialState);

  // 篩選條件同步進網址（replaceState：不污染上一頁/下一頁）
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("from", state.range.from);
    q.set("to", state.range.to);
    q.set("g", state.granularity);
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [state.range.from, state.range.to, state.granularity]);

  const handlePreset = useCallback((key: string) => {
    const preset = RANGE_PRESETS.find((p) => p.key === key);
    if (!preset) return;
    const range = preset.build();
    setState({ range, granularity: suggestGranularity(range), preset: key });
  }, []);

  const handleRangeChange = useCallback((range: DateRange) => {
    // 手動改日期時保持前後順序合法，避免送出 from > to 被後端擋下
    const safe: DateRange =
      range.from > range.to ? { from: range.to, to: range.from } : range;
    setState({ range: safe, granularity: suggestGranularity(safe), preset: null });
  }, []);

  const handleGranularity = useCallback((granularity: Granularity) => {
    setState((prev) => ({ ...prev, granularity }));
  }, []);

  const summary = useRevenueSummary(state.range, isAuthenticated);
  const timeseries = useRevenueTimeseries(state.range, state.granularity, isAuthenticated);

  return (
    <UnifiedAdminLayout title="💰 財務中心 / 營收總覽">
      <div className="space-y-5">
        <div className="rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
          <h2 className="text-xl font-bold mb-1">💰 財務中心</h2>
          <p className="text-emerald-50 text-sm">
            現場收款、遊戲購買、對戰報名的統合營收分析（金額已扣除退款）
          </p>
        </div>

        <RevenueFilterBar
          range={state.range}
          granularity={state.granularity}
          activePreset={state.preset}
          onPreset={handlePreset}
          onRangeChange={handleRangeChange}
          onGranularityChange={handleGranularity}
        />

        {summary.isError && (
          <Card className="border-destructive/50">
            <CardContent className="p-4 text-sm text-destructive">
              營收資料載入失敗，請重新整理或縮小查詢區間後再試。
            </CardContent>
          </Card>
        )}

        <RevenueKpiCards data={summary.data} isLoading={summary.isLoading} />

        <RevenueTrendChart
          series={timeseries.data?.series}
          granularity={state.granularity}
          isLoading={timeseries.isLoading}
        />

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <RevenueSourceChart data={summary.data} isLoading={summary.isLoading} />
          </div>
          <div className="lg:col-span-2">
            <RevenueHeatmap range={state.range} enabled={isAuthenticated} />
          </div>
        </div>

        <RevenueBreakdownPanel range={state.range} enabled={isAuthenticated} />

        <RevenueTransactionsPanel range={state.range} enabled={isAuthenticated} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">快速操作</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <QuickLink
                href="/admin/revenue/products"
                icon={<Package className="w-5 h-5" />}
                label="商品管理"
                description="遊戲與對戰場地定價"
              />
              <QuickLink
                href="/admin/revenue/codes"
                icon={<Ticket className="w-5 h-5" />}
                label="兌換碼中心"
                description="跨遊戲兌換碼"
              />
              <QuickLink
                href="/admin/revenue/transactions"
                icon={<Receipt className="w-5 h-5" />}
                label="交易記錄"
                description="所有購買與報名"
              />
              <QuickLink
                href="/admin/pos-reports"
                icon={<DollarSign className="w-5 h-5" />}
                label="POS 每日報表"
                description="現場銷售與結帳"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </UnifiedAdminLayout>
  );
}

function QuickLink({
  href,
  icon,
  label,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Button
        variant="outline"
        className="h-auto w-full justify-start flex-col items-start gap-1 p-4"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {label}
        </div>
        <p className="text-xs text-muted-foreground font-normal">{description}</p>
      </Button>
    </Link>
  );
}
