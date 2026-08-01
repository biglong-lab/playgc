// 📊 營收分析 — 共用型別、查詢 hooks 與格式化
//
// 金額一律以「分」在前後端之間傳遞，只有這裡的 money* 函式會除以 100。
// 元件不得自行做 /100，避免又出現幣別混用的老問題。

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export type RevenueSource = "pos" | "game" | "battle";
export type Granularity = "day" | "week" | "month";
export type BreakdownDimension =
  | "source" | "pos_product" | "pos_category" | "pos_modifier"
  | "activity" | "method" | "catalog";

export interface DateRange {
  from: string;
  to: string;
}

export interface SourceStat {
  grossCents: number;
  refundCents: number;
  netCents: number;
  txCount: number;
}

export interface SummaryResponse {
  range: DateRange & { days: number };
  grossCents: number;
  refundCents: number;
  netCents: number;
  txCount: number;
  avgTicketCents: number;
  refundRate: number;
  bySource: Record<RevenueSource, SourceStat>;
  previous: {
    range: DateRange;
    netCents: number;
    grossCents: number;
    txCount: number;
    growth: { netCents: number | null; txCount: number | null };
  } | null;
}

export interface TimeBucket {
  bucket: string;
  posCents: number;
  gameCents: number;
  battleCents: number;
  refundCents: number;
  netCents: number;
  cumulativeCents: number;
  txCount: number;
}

export interface TimeseriesResponse {
  range: DateRange;
  granularity: Granularity;
  series: TimeBucket[];
}

export interface BreakdownRow {
  key: string;
  label: string;
  cents: number;
  count: number;
  qty?: number;
  share: number;
}

export interface BreakdownResponse {
  range: DateRange;
  dimension: BreakdownDimension;
  rows: BreakdownRow[];
  totalCents: number;
}

export interface UnifiedTransaction {
  id: string;
  source: RevenueSource;
  occurredAt: string | null;
  businessDate: string;
  amountCents: number;
  label: string;
  detail: string | null;
  status: string;
}

export interface TransactionsResponse {
  range: DateRange;
  transactions: UnifiedTransaction[];
  total: number;
  truncated: boolean;
}

// ============================================================================
// 格式化（唯一會把「分」轉成「元」的地方）
// ============================================================================

export function money(cents: number): string {
  return `NT$ ${Math.round(cents / 100).toLocaleString("zh-TW")}`;
}

/** 軸標籤用的短格式，避免長數字把圖表擠變形 */
export function moneyCompact(cents: number): string {
  const twd = Math.round(cents / 100);
  if (Math.abs(twd) >= 10_000) return `${(twd / 10_000).toFixed(1)}萬`;
  if (Math.abs(twd) >= 1_000) return `${(twd / 1_000).toFixed(1)}千`;
  return String(twd);
}

export function percent(value: number | null): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

/** 依粒度決定桶標籤：日=MM/DD、週=MM/DD 起、月=YYYY/MM */
export function formatBucket(bucket: string, g: Granularity): string {
  const [y, m, d] = bucket.split("-");
  if (g === "month") return `${y}/${m}`;
  if (g === "week") return `${m}/${d}起`;
  return `${m}/${d}`;
}

// ============================================================================
// 日期區間
// ============================================================================

export function taipeiToday(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric", month: "2-digit", day: "2-digit",
    })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function shiftDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface RangePreset {
  key: string;
  label: string;
  build: () => DateRange;
}

export const RANGE_PRESETS: readonly RangePreset[] = [
  { key: "today", label: "今日", build: () => ({ from: taipeiToday(), to: taipeiToday() }) },
  { key: "7d", label: "近 7 天", build: () => ({ from: shiftDays(taipeiToday(), -6), to: taipeiToday() }) },
  { key: "30d", label: "近 30 天", build: () => ({ from: shiftDays(taipeiToday(), -29), to: taipeiToday() }) },
  {
    key: "mtd",
    label: "本月",
    build: () => ({ from: `${taipeiToday().slice(0, 7)}-01`, to: taipeiToday() }),
  },
  { key: "90d", label: "近 90 天", build: () => ({ from: shiftDays(taipeiToday(), -89), to: taipeiToday() }) },
  {
    key: "ytd",
    label: "今年",
    build: () => ({ from: `${taipeiToday().slice(0, 4)}-01-01`, to: taipeiToday() }),
  },
] as const;

/** 區間跨度自動決定合適粒度：≤31天用日、≤120天用週、更長用月 */
export function suggestGranularity(range: DateRange): Granularity {
  const days =
    Math.round(
      (new Date(`${range.to}T00:00:00Z`).getTime() - new Date(`${range.from}T00:00:00Z`).getTime()) /
        86_400_000,
    ) + 1;
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

// ============================================================================
// 查詢 hooks
// ============================================================================

async function fetchJson<T>(url: string): Promise<T> {
  const res = await apiRequest("GET", url);
  return res.json() as Promise<T>;
}

const BASE = "/api/revenue/analytics";

export function useRevenueSummary(
  range: DateRange,
  enabled: boolean,
): UseQueryResult<SummaryResponse> {
  return useQuery<SummaryResponse>({
    queryKey: [`${BASE}/summary`, range.from, range.to],
    queryFn: () => fetchJson(`${BASE}/summary?from=${range.from}&to=${range.to}&compare=prev`),
    enabled,
  });
}

export function useRevenueTimeseries(
  range: DateRange,
  granularity: Granularity,
  enabled: boolean,
): UseQueryResult<TimeseriesResponse> {
  return useQuery<TimeseriesResponse>({
    queryKey: [`${BASE}/timeseries`, range.from, range.to, granularity],
    queryFn: () =>
      fetchJson(`${BASE}/timeseries?from=${range.from}&to=${range.to}&granularity=${granularity}`),
    enabled,
  });
}

export function useRevenueBreakdown(
  range: DateRange,
  dimension: BreakdownDimension,
  enabled: boolean,
  limit = 15,
): UseQueryResult<BreakdownResponse> {
  return useQuery<BreakdownResponse>({
    queryKey: [`${BASE}/breakdown`, range.from, range.to, dimension, limit],
    queryFn: () =>
      fetchJson(
        `${BASE}/breakdown?from=${range.from}&to=${range.to}&dimension=${dimension}&limit=${limit}`,
      ),
    enabled,
  });
}

export function useRevenueTransactions(
  range: DateRange,
  sources: RevenueSource[],
  enabled: boolean,
): UseQueryResult<TransactionsResponse> {
  const srcParam = sources.length ? `&sources=${sources.join(",")}` : "";
  return useQuery<TransactionsResponse>({
    queryKey: [`${BASE}/transactions`, range.from, range.to, sources.join(",")],
    queryFn: () => fetchJson(`${BASE}/transactions?from=${range.from}&to=${range.to}${srcParam}`),
    enabled,
  });
}
