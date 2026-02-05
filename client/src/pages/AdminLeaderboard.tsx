import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AdminLayout from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { LeaderboardEntry, Game } from "@shared/schema";
import {
  Trophy, Medal, Crown, Star, TrendingUp, Calendar,
  RefreshCw, Users
} from "lucide-react";

export default function AdminLeaderboard() {
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [timeFilter, setTimeFilter] = useState<string>("all");

  const { data: leaderboard = [], isLoading, refetch } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard"],
    refetchInterval: 30000,
  });

  const { data: games = [] } = useQuery<Game[]>({
    queryKey: ["/api/admin/games"],
  });

  const filteredLeaderboard = leaderboard.filter(entry => {
    const matchesGame = gameFilter === "all" || entry.gameId === gameFilter;
    
    if (timeFilter === "all") return matchesGame;
    
    if (!entry.createdAt) return matchesGame;
    
    const entryDate = new Date(entry.createdAt);
    const now = new Date();
    
    switch (timeFilter) {
      case "today":
        return matchesGame && entryDate.toDateString() === now.toDateString();
      case "week":
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return matchesGame && entryDate >= weekAgo;
      case "month":
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return matchesGame && entryDate >= monthAgo;
      default:
        return matchesGame;
    }
  }).sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));

  const topThree = filteredLeaderboard.slice(0, 3);
  const rest = filteredLeaderboard.slice(3);

  const totalTeams = new Set(leaderboard.map(e => e.teamName).filter(Boolean)).size;
  const highestScore = leaderboard.length > 0 ? Math.max(...leaderboard.map(e => e.totalScore || 0)) : 0;
  const averageScore = leaderboard.length > 0 
    ? Math.round(leaderboard.reduce((sum, e) => sum + (e.totalScore || 0), 0) / leaderboard.length)
    : 0;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Medal className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="font-number font-bold text-lg text-muted-foreground">{rank}</span>;
    }
  };

  const getRankColor = (rank: number) => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/30";
      case 2:
        return "bg-gray-400/10 border-gray-400/30";
      case 3:
        return "bg-amber-600/10 border-amber-600/30";
      default:
        return "";
    }
  };

  const getGameTitle = (gameId: string | null) => {
    if (!gameId) return "未知遊戲";
    const game = games.find(g => g.id === gameId);
    return game?.title || gameId;
  };

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatTime = (seconds: number | null) => {
    if (!seconds) return "N/A";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <AdminLayout 
      title="排行榜管理"
      actions={
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          className="gap-1"
          data-testid="button-refresh-leaderboard"
        >
          <RefreshCw className="w-4 h-4" />
          重新整理
        </Button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">參與隊伍</p>
                  <p className="font-number text-3xl font-bold">{totalTeams}</p>
                </div>
                <Users className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">最高分數</p>
                  <p className="font-number text-3xl font-bold text-success">{highestScore}</p>
                </div>
                <Crown className="w-8 h-8 text-yellow-500/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">平均分數</p>
                  <p className="font-number text-3xl font-bold">{averageScore}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">總紀錄數</p>
                  <p className="font-number text-3xl font-bold">{leaderboard.length}</p>
                </div>
                <Trophy className="w-8 h-8 text-primary/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <Select value={gameFilter} onValueChange={setGameFilter}>
            <SelectTrigger className="w-full md:w-48" data-testid="select-game-filter">
              <SelectValue placeholder="遊戲" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部遊戲</SelectItem>
              {games.map(game => (
                <SelectItem key={game.id} value={game.id}>{game.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={timeFilter} onValueChange={setTimeFilter}>
            <SelectTrigger className="w-full md:w-40" data-testid="select-time-filter">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="時間" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部時間</SelectItem>
              <SelectItem value="today">今天</SelectItem>
              <SelectItem value="week">本週</SelectItem>
              <SelectItem value="month">本月</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredLeaderboard.length > 0 ? (
          <div className="space-y-6">
            {topThree.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {topThree.map((entry, index) => (
                  <Card 
                    key={entry.id} 
                    className={`relative overflow-hidden ${getRankColor(index + 1)}`}
                    data-testid={`card-rank-${index + 1}`}
                  >
                    <div className="absolute top-2 right-2">
                      {getRankIcon(index + 1)}
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback className="bg-primary/20 text-primary font-display">
                            {entry.teamName?.charAt(0) || "?"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <CardTitle className="text-lg">{entry.teamName || "匿名隊伍"}</CardTitle>
                          <p className="text-xs text-muted-foreground">{getGameTitle(entry.gameId)}</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center mt-2">
                        <p className="font-number text-4xl font-bold text-primary">{entry.totalScore || 0}</p>
                        <p className="text-xs text-muted-foreground mt-1">分</p>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-4">
                        <span>{formatDate(entry.createdAt)}</span>
                        {entry.completionTimeSeconds && <span>{formatTime(entry.completionTimeSeconds)}</span>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {rest.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    其他排名
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {rest.map((entry, index) => (
                      <div 
                        key={entry.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover-elevate"
                        data-testid={`row-rank-${index + 4}`}
                      >
                        <div className="flex items-center gap-4">
                          <span className="font-number font-bold text-lg text-muted-foreground w-8 text-center">
                            {index + 4}
                          </span>
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {entry.teamName?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{entry.teamName || "匿名隊伍"}</p>
                            <p className="text-xs text-muted-foreground">{getGameTitle(entry.gameId)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-number font-bold text-primary">{entry.totalScore || 0}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-20">
            <Trophy className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">尚無排行榜記錄</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
