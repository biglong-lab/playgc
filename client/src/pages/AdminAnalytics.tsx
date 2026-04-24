// 數據分析頁面 — 統一使用 UnifiedAdminLayout
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import UnifiedAdminLayout from "@/components/UnifiedAdminLayout";
import { GridSkeleton } from "@/components/shared/LoadingSkeleton";
import MetricCard from "@/components/shared/MetricCard";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import {
  BarChart3, Users, Clock, TrendingUp, CheckCircle, PlayCircle
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";

interface AnalyticsOverview {
  totalGames: number;
  publishedGames: number;
  totalSessions: number;
  completedSessions: number;
  activeSessions: number;
  todaySessions: number;
  averagePlayTime: number;
  overallCompletionRate: number;
  gameStats: {
    gameId: string;
    title: string;
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
  }[];
}

interface SessionAnalytics {
  dailyStats: {
    date: string;
    total: number;
    completed: number;
  }[];
  recentSessions: {
    id: string;
    gameId: string;
    gameTitle: string;
    status: string;
    startTime: string;
    endTime: string | null;
  }[];
}

export default function AdminAnalytics() {
  const { isAuthenticated } = useAdminAuth();

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/analytics/overview"],
    enabled: isAuthenticated,
  });

  const { data: sessionData, isLoading: sessionsLoading } = useQuery<SessionAnalytics>({
    queryKey: ["/api/analytics/sessions"],
    enabled: isAuthenticated,
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-success">已完成</Badge>;
      case "playing":
        return <Badge className="bg-primary">進行中</Badge>;
      case "waiting":
        return <Badge variant="secondary">等待中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // 🆕 拆開兩個 loading：overview 早回時 stat cards 先渲染，不用等 sessions
  return (
    <UnifiedAdminLayout title="數據分析">
      {overviewLoading ? (
        <GridSkeleton count={4} cols={4} />
      ) : (
        <AnalyticsStatCards overview={overview} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6 mt-6">
        {sessionsLoading ? (
          <GridSkeleton count={1} cols={2} />
        ) : (
          <DailyTrendChart
            dailyStats={sessionData?.dailyStats}
            formatDate={formatDate}
          />
        )}
        {overviewLoading ? (
          <GridSkeleton count={1} cols={2} />
        ) : (
          <GameCompletionChart gameStats={overview?.gameStats} />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overviewLoading ? (
          <GridSkeleton count={1} cols={2} />
        ) : (
          <GameStatsCard gameStats={overview?.gameStats} />
        )}
        {sessionsLoading ? (
          <GridSkeleton count={1} cols={2} />
        ) : (
          <RecentSessionsCard
            recentSessions={sessionData?.recentSessions}
            formatTime={formatTime}
            getStatusBadge={getStatusBadge}
          />
        )}
      </div>
    </UnifiedAdminLayout>
  );
}

// ============================================================================
// 子元件
// ============================================================================

function AnalyticsStatCards({ overview }: { overview?: AnalyticsOverview }) {
  // 🆕 無 session 時顯示破折號，避免 0 當真實數字誤導
  const total = overview?.totalSessions ?? 0;
  const hasData = total > 0;
  const active = overview?.activeSessions ?? 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">總遊戲場次</p>
              <p
                className={`font-number text-3xl font-bold ${hasData ? "" : "text-muted-foreground"}`}
                data-testid="analytics-total-sessions"
              >
                {total}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                今日: {overview?.todaySessions ?? 0} 場
              </p>
            </div>
            <Users className={`w-8 h-8 ${hasData ? "text-primary/50" : "text-muted-foreground/30"}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">完成率</p>
              <p
                className={`font-number text-3xl font-bold ${hasData ? "text-success" : "text-muted-foreground"}`}
                data-testid="analytics-completion-rate"
              >
                {hasData ? `${overview?.overallCompletionRate ?? 0}%` : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                完成: {overview?.completedSessions ?? 0} 場
              </p>
            </div>
            <CheckCircle className={`w-8 h-8 ${hasData ? "text-success/50" : "text-muted-foreground/30"}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                進行中場次
                {/* 🆕 有 active 時加脈衝綠點 LIVE 指示 */}
                {active > 0 && (
                  <span className="relative flex h-2 w-2" aria-label="live">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
                  </span>
                )}
              </p>
              <p
                className={`font-number text-3xl font-bold ${active > 0 ? "text-warning" : "text-muted-foreground"}`}
                data-testid="analytics-active-sessions"
              >
                {active}
              </p>
              <p className="text-xs text-muted-foreground mt-1">即時玩家數</p>
            </div>
            <PlayCircle className={`w-8 h-8 ${active > 0 ? "text-warning/50" : "text-muted-foreground/30"}`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">平均遊戲時間</p>
              <p
                className={`font-number text-3xl font-bold ${hasData ? "" : "text-muted-foreground"}`}
                data-testid="analytics-avg-play-time"
              >
                {hasData ? (overview?.averagePlayTime ?? 0) : "—"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">分鐘/場</p>
            </div>
            <Clock className="w-8 h-8 text-muted-foreground/50" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface DailyTrendChartProps {
  dailyStats?: { date: string; total: number; completed: number }[];
  formatDate: (dateStr: string) => string;
}

function DailyTrendChart({ dailyStats, formatDate }: DailyTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          近7日場次趨勢
        </CardTitle>
      </CardHeader>
      <CardContent>
        {dailyStats && dailyStats.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  labelFormatter={formatDate}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="總場次"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))" }}
                />
                <Line
                  type="monotone"
                  dataKey="completed"
                  name="完成場次"
                  stroke="hsl(var(--success))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--success))" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            尚無數據
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GameCompletionChart({ gameStats }: { gameStats?: AnalyticsOverview["gameStats"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          遊戲完成率
        </CardTitle>
      </CardHeader>
      <CardContent>
        {gameStats && gameStats.length > 0 ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={gameStats} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  type="category"
                  dataKey="title"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  width={75}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value}%`, "完成率"]}
                />
                <Bar dataKey="completionRate" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-muted-foreground">
            尚無遊戲數據
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GameStatsCard({ gameStats }: { gameStats?: AnalyticsOverview["gameStats"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">各遊戲統計</CardTitle>
        <CardDescription>各遊戲的場次與完成率</CardDescription>
      </CardHeader>
      <CardContent>
        {gameStats && gameStats.length > 0 ? (
          <div className="space-y-4">
            {gameStats.map((game) => (
              <div key={game.gameId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{game.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {game.completedSessions}/{game.totalSessions} 場
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress value={game.completionRate} className="flex-1" />
                  <span className="text-sm font-number w-12 text-right">
                    {game.completionRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            尚無遊戲數據
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface RecentSessionsCardProps {
  recentSessions?: SessionAnalytics["recentSessions"];
  formatTime: (dateStr: string | null) => string;
  getStatusBadge: (status: string) => React.ReactNode;
}

function RecentSessionsCard({ recentSessions, formatTime, getStatusBadge }: RecentSessionsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">最近場次</CardTitle>
        <CardDescription>最近進行的遊戲場次</CardDescription>
      </CardHeader>
      <CardContent>
        {recentSessions && recentSessions.length > 0 ? (
          <div className="space-y-3">
            {recentSessions.slice(0, 8).map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              >
                <div>
                  <p className="font-medium text-sm">{session.gameTitle}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatTime(session.startTime)}
                    {session.endTime && ` - ${formatTime(session.endTime)}`}
                  </p>
                </div>
                {getStatusBadge(session.status)}
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            尚無場次記錄
          </div>
        )}
      </CardContent>
    </Card>
  );
}
