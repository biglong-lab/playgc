import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import {
  Gamepad2, Settings, Cpu, BarChart3,
  Trophy, Home, LogOut, Activity, 
  Users, Clock, TrendingUp, CheckCircle,
  PlayCircle
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

const menuItems = [
  { title: "總覽", icon: Home, path: "/admin" },
  { title: "遊戲管理", icon: Gamepad2, path: "/admin/games" },
  { title: "進行中場次", icon: Activity, path: "/admin/sessions" },
  { title: "設備管理", icon: Cpu, path: "/admin/devices" },
  { title: "數據分析", icon: BarChart3, path: "/admin/analytics" },
  { title: "排行榜", icon: Trophy, path: "/admin/leaderboard" },
  { title: "系統設定", icon: Settings, path: "/admin/settings" },
];

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
  const { user, isLoading: authLoading } = useAuth();

  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ["/api/analytics/overview"],
  });

  const { data: sessionData, isLoading: sessionsLoading } = useQuery<SessionAnalytics>({
    queryKey: ["/api/analytics/sessions"],
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    window.location.href = "/";
    return null;
  }

  const isLoading = overviewLoading || sessionsLoading;

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleTimeString("zh-TW", { 
      hour: "2-digit", 
      minute: "2-digit" 
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

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <Sidebar>
          <SidebarHeader className="p-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-sm">賈村競技場</h1>
                <p className="text-xs text-sidebar-foreground/60">管理後台</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>主選單</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton 
                        asChild
                        isActive={item.path === "/admin/analytics"}
                      >
                        <Link href={item.path}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-sidebar-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profileImageUrl || undefined} />
                  <AvatarFallback>{(user.firstName?.[0] || "A").toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{user.firstName || "Admin"}</span>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <div className="flex flex-col flex-1">
          <header className="flex items-center justify-between p-4 border-b border-border bg-background">
            <div className="flex items-center gap-4">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h2 className="font-display font-bold text-lg">數據分析</h2>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">總遊戲場次</p>
                          <p className="font-number text-3xl font-bold">{overview?.totalSessions || 0}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            今日: {overview?.todaySessions || 0} 場
                          </p>
                        </div>
                        <Users className="w-8 h-8 text-primary/50" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">完成率</p>
                          <p className="font-number text-3xl font-bold text-success">
                            {overview?.overallCompletionRate || 0}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            完成: {overview?.completedSessions || 0} 場
                          </p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-success/50" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">進行中場次</p>
                          <p className="font-number text-3xl font-bold text-warning">
                            {overview?.activeSessions || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            即時玩家數
                          </p>
                        </div>
                        <PlayCircle className="w-8 h-8 text-warning/50" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-muted-foreground">平均遊戲時間</p>
                          <p className="font-number text-3xl font-bold">
                            {overview?.averagePlayTime || 0}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            分鐘/場
                          </p>
                        </div>
                        <Clock className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <TrendingUp className="w-5 h-5" />
                        近7日場次趨勢
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {sessionData?.dailyStats && sessionData.dailyStats.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sessionData.dailyStats}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={formatDate}
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                              />
                              <YAxis 
                                stroke="hsl(var(--muted-foreground))"
                                fontSize={12}
                              />
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <BarChart3 className="w-5 h-5" />
                        遊戲完成率
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {overview?.gameStats && overview.gameStats.length > 0 ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart 
                              data={overview.gameStats}
                              layout="vertical"
                              margin={{ left: 80 }}
                            >
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
                              <Bar 
                                dataKey="completionRate" 
                                fill="hsl(var(--primary))"
                                radius={[0, 4, 4, 0]}
                              />
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
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">各遊戲統計</CardTitle>
                      <CardDescription>各遊戲的場次與完成率</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {overview?.gameStats && overview.gameStats.length > 0 ? (
                        <div className="space-y-4">
                          {overview.gameStats.map((game) => (
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

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">最近場次</CardTitle>
                      <CardDescription>最近進行的遊戲場次</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {sessionData?.recentSessions && sessionData.recentSessions.length > 0 ? (
                        <div className="space-y-3">
                          {sessionData.recentSessions.slice(0, 8).map((session) => (
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
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
