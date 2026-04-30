// 📈 平台數據洞察（A 區塊整合面板）
//
// 整合 6 個 endpoint：
//   /insights/overview — 整體 KPI
//   /insights/engagement — DAU/WAU/MAU
//   /insights/field-rankings — 場域排行（多指標可切換）
//   /insights/game-rankings — 遊戲熱度
//   /insights/component-usage — pageType 使用次數
//   /insights/daily-trend — 30 天趨勢
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import PlatformAdminLayout from "@/components/PlatformAdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Gamepad2,
  Users,
  TrendingUp,
  Trophy,
  Layers,
  Activity,
  CheckCircle2,
  DollarSign,
  Sparkles,
} from "lucide-react";

interface OverviewData {
  total_fields: number;
  total_users: number;
  total_games: number;
  total_sessions: number;
  sessions_today: number;
  sessions_24h: number;
  sessions_7d: number;
  sessions_30d: number;
  completed_sessions: number;
  total_revenue: number;
  completionRate: number;
}

interface EngagementData {
  dau: number;
  wau: number;
  mau: number;
  stickiness: number;
}

interface FieldRanking {
  field_id: string;
  field_name: string;
  field_code: string;
  total_games: number;
  total_sessions: number;
  active_users: number;
  revenue: number;
}

interface GameRanking {
  game_id: string;
  game_title: string;
  field_code: string | null;
  total_sessions: number;
  completed_sessions: number;
  unique_players: number;
  avg_score: number;
  completionRate: number;
}

interface ComponentUsage {
  page_type: string;
  usage_count: number;
  unique_pages: number;
}

interface DailyTrend {
  day: string;
  sessions: number;
  dau: number;
}

const PAGE_TYPE_LABELS: Record<string, string> = {
  text_card: "字卡",
  dialogue: "對話",
  video: "影片",
  button: "按鈕選擇",
  text_verify: "文字驗證",
  choice_verify: "選擇題",
  conditional_verify: "條件驗證",
  shooting_mission: "射擊任務",
  photo_mission: "拍照任務",
  photo_spot: "指定拍照",
  photo_compare: "照片對比",
  photo_before_after: "前後對比",
  photo_burst: "連拍",
  photo_ar: "AR 貼圖",
  photo_team: "團體合影",
  photo_ocr: "招牌辨識",
  gps_mission: "GPS 任務",
  qr_scan: "QR 掃描",
  time_bomb: "拆彈任務",
  lock: "密碼鎖",
  motion_challenge: "動作挑戰",
  vote: "投票",
  flow_router: "流程路由",
};

export default function PlatformInsights() {
  const { isAuthenticated } = useAdminAuth();
  const [fieldMetric, setFieldMetric] = useState<"sessions" | "players" | "games" | "revenue">("sessions");

  const { data: overview } = useQuery<OverviewData>({
    queryKey: ["/api/platform/insights/overview"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/insights/overview")).json(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: engagement } = useQuery<EngagementData>({
    queryKey: ["/api/platform/insights/engagement"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/insights/engagement")).json(),
    enabled: isAuthenticated,
    refetchInterval: 60_000,
  });

  const { data: fieldRanks } = useQuery<{ items: FieldRanking[]; metric: string }>({
    queryKey: ["/api/platform/insights/field-rankings", fieldMetric],
    queryFn: async () => (await apiRequest("GET", `/api/platform/insights/field-rankings?metric=${fieldMetric}`)).json(),
    enabled: isAuthenticated,
  });

  const { data: gameRanks } = useQuery<{ items: GameRanking[] }>({
    queryKey: ["/api/platform/insights/game-rankings"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/insights/game-rankings")).json(),
    enabled: isAuthenticated,
  });

  const { data: components } = useQuery<{ items: ComponentUsage[] }>({
    queryKey: ["/api/platform/insights/component-usage"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/insights/component-usage")).json(),
    enabled: isAuthenticated,
  });

  const { data: trend } = useQuery<{ items: DailyTrend[] }>({
    queryKey: ["/api/platform/insights/daily-trend"],
    queryFn: async () => (await apiRequest("GET", "/api/platform/insights/daily-trend")).json(),
    enabled: isAuthenticated,
  });

  const maxSessionsInTrend = Math.max(...(trend?.items.map((t) => t.sessions) ?? [1]), 1);
  const maxComponentUsage = Math.max(...(components?.items.map((c) => c.usage_count) ?? [1]), 1);
  const fieldMaxValue = (() => {
    const items = fieldRanks?.items ?? [];
    if (items.length === 0) return 1;
    return Math.max(
      ...items.map((f) => {
        if (fieldMetric === "players") return f.active_users;
        if (fieldMetric === "games") return f.total_games;
        if (fieldMetric === "revenue") return f.revenue;
        return f.total_sessions;
      }),
      1,
    );
  })();

  return (
    <PlatformAdminLayout title="平台數據洞察">
      {/* 整體 KPI 6 格 */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <KpiCard label="場域數" value={overview?.total_fields} icon={<Building2 className="w-4 h-4" />} accent="text-primary" />
        <KpiCard label="總玩家" value={overview?.total_users} icon={<Users className="w-4 h-4" />} accent="text-blue-500" />
        <KpiCard label="總遊戲" value={overview?.total_games} icon={<Gamepad2 className="w-4 h-4" />} accent="text-purple-500" />
        <KpiCard label="總場次" value={overview?.total_sessions} icon={<Activity className="w-4 h-4" />} accent="text-amber-500" />
        <KpiCard label="完成率" value={overview?.completionRate} suffix="%" icon={<CheckCircle2 className="w-4 h-4" />} accent="text-emerald-500" />
        <KpiCard label="累計收益" value={overview?.total_revenue} prefix="NT$" icon={<DollarSign className="w-4 h-4" />} accent="text-green-500" />
      </div>

      {/* 活躍度 + 期間場次 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-semibold">活躍玩家</h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="DAU" value={engagement?.dau ?? 0} accent="text-emerald-500" />
              <MiniMetric label="WAU" value={engagement?.wau ?? 0} accent="text-blue-500" />
              <MiniMetric label="MAU" value={engagement?.mau ?? 0} accent="text-amber-500" />
            </div>
            {engagement && engagement.mau > 0 && (
              <div className="mt-3 text-xs text-muted-foreground">
                黏著度 (DAU/MAU)：<span className="font-bold text-foreground tabular-nums">{engagement.stickiness}%</span>
                {engagement.stickiness >= 20 && <span className="ml-1 text-emerald-500">優秀</span>}
                {engagement.stickiness >= 10 && engagement.stickiness < 20 && <span className="ml-1 text-amber-500">良好</span>}
                {engagement.stickiness < 10 && <span className="ml-1 text-muted-foreground">普通</span>}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">場次成長</h3>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <MiniMetric label="今日" value={overview?.sessions_today ?? 0} accent="text-primary" />
              <MiniMetric label="24h" value={overview?.sessions_24h ?? 0} accent="text-amber-500" />
              <MiniMetric label="7d" value={overview?.sessions_7d ?? 0} accent="text-blue-500" />
              <MiniMetric label="30d" value={overview?.sessions_30d ?? 0} accent="text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 30 天每日趨勢（簡易 bar chart）*/}
      <Card className="mb-6">
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
            <Activity className="w-4 h-4" /> 過去 30 天每日場次
          </h3>
          {trend?.items.length ? (
            <div className="flex items-end gap-1 h-24">
              {trend.items.map((d) => {
                const heightPct = Math.round((d.sessions / maxSessionsInTrend) * 100);
                const date = new Date(d.day);
                return (
                  <div
                    key={d.day}
                    className="flex-1 bg-primary/70 hover:bg-primary transition-colors rounded-sm relative group cursor-help"
                    style={{ height: `${heightPct}%`, minHeight: "2px" }}
                    title={`${d.day} · 場次 ${d.sessions} · DAU ${d.dau}`}
                  >
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] px-1 py-0.5 rounded whitespace-nowrap z-10">
                      {date.getMonth() + 1}/{date.getDate()}: {d.sessions}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">尚無資料</p>
          )}
        </CardContent>
      </Card>

      {/* 場域排行 */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-1">
              <Trophy className="w-4 h-4" /> 場域排行（過去 30 天）
            </h3>
            <Select value={fieldMetric} onValueChange={(v) => setFieldMetric(v as typeof fieldMetric)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sessions">場次數</SelectItem>
                <SelectItem value="players">活躍玩家</SelectItem>
                <SelectItem value="games">遊戲數</SelectItem>
                <SelectItem value="revenue">收益</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {fieldRanks?.items.length ? (
            <div className="space-y-2">
              {fieldRanks.items.slice(0, 10).map((f, idx) => {
                const value = fieldMetric === "players" ? f.active_users
                  : fieldMetric === "games" ? f.total_games
                  : fieldMetric === "revenue" ? f.revenue
                  : f.total_sessions;
                const widthPct = (value / fieldMaxValue) * 100;
                return (
                  <div key={f.field_id} className="flex items-center gap-3">
                    <span className="w-6 text-sm font-bold text-muted-foreground tabular-nums">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">{f.field_name}</span>
                        <Badge variant="outline" className="text-[10px]">{f.field_code}</Badge>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                        <div className="h-full bg-primary transition-all" style={{ width: `${widthPct}%` }} />
                      </div>
                    </div>
                    <span className="text-sm font-bold tabular-nums w-20 text-right">
                      {fieldMetric === "revenue" ? `NT$${value.toLocaleString()}` : value.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">尚無資料</p>
          )}
        </CardContent>
      </Card>

      {/* 遊戲熱度 + 元件使用 兩欄 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* 遊戲熱度 Top 10 */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <Gamepad2 className="w-4 h-4" /> 遊戲熱度 Top 10（過去 30 天）
            </h3>
            {gameRanks?.items.length ? (
              <div className="space-y-1">
                {gameRanks.items.slice(0, 10).map((g, idx) => (
                  <div key={g.game_id} className="flex items-center gap-2 py-1.5 border-b last:border-b-0">
                    <span className="w-6 text-xs font-bold text-muted-foreground tabular-nums">#{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs truncate">{g.game_title}</span>
                        {g.field_code && (
                          <Badge variant="outline" className="text-[9px]">{g.field_code}</Badge>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground tabular-nums flex gap-2 mt-0.5">
                        <span>{g.total_sessions} 場</span>
                        <span>·</span>
                        <span>{g.unique_players} 玩家</span>
                        <span>·</span>
                        <span className={g.completionRate >= 70 ? "text-emerald-500" : "text-amber-500"}>
                          完成 {g.completionRate}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">尚無資料</p>
            )}
          </CardContent>
        </Card>

        {/* 元件使用次數（過去 30 天）*/}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
              <Layers className="w-4 h-4" /> 元件使用排行（過去 30 天）
            </h3>
            {components?.items.length ? (
              <div className="space-y-2">
                {components.items.slice(0, 12).map((c) => {
                  const widthPct = (c.usage_count / maxComponentUsage) * 100;
                  return (
                    <div key={c.page_type}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium">
                          {PAGE_TYPE_LABELS[c.page_type] || c.page_type}
                        </span>
                        <span className="tabular-nums text-muted-foreground">
                          {c.usage_count.toLocaleString()} 次 · {c.unique_pages} 頁
                        </span>
                      </div>
                      <Progress value={widthPct} className="h-1" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">尚無資料</p>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformAdminLayout>
  );
}

function KpiCard({
  label,
  value,
  icon,
  accent,
  prefix,
  suffix,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  accent: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-2xl font-bold tabular-nums ${accent}`}>
          {prefix}{(value ?? 0).toLocaleString()}{suffix}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniMetric({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold tabular-nums ${accent}`}>
        {value.toLocaleString()}
      </div>
    </div>
  );
}
