import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardEntry, Game } from "@shared/schema";
import { 
  Trophy, Medal, Clock, Users, ArrowLeft, Crown,
  Flame, Star, ChevronRight
} from "lucide-react";

export default function Leaderboard() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", selectedGame],
  });

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="font-number text-lg font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getRankColor = (rank: number): string => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/10 border-yellow-500/30 hover:border-yellow-500/50";
      case 2:
        return "bg-gray-400/10 border-gray-400/30 hover:border-gray-400/50";
      case 3:
        return "bg-amber-600/10 border-amber-600/30 hover:border-amber-600/50";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/home">
                <Button variant="ghost" size="icon" data-testid="button-back">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="font-display font-bold text-lg">排行榜</h1>
                  <p className="text-xs text-muted-foreground">Leaderboard</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30">
            <CardContent className="p-6 text-center">
              <Crown className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">冠軍</p>
              <p className="font-display font-bold text-lg">
                {leaderboard?.[0]?.teamName || "—"}
              </p>
              <p className="font-number text-2xl text-yellow-500">
                {leaderboard?.[0]?.totalScore || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-gray-400/10 to-gray-500/5 border-gray-400/30">
            <CardContent className="p-6 text-center">
              <Medal className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">亞軍</p>
              <p className="font-display font-bold text-lg">
                {leaderboard?.[1]?.teamName || "—"}
              </p>
              <p className="font-number text-2xl text-gray-400">
                {leaderboard?.[1]?.totalScore || 0}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-600/10 to-amber-700/5 border-amber-600/30">
            <CardContent className="p-6 text-center">
              <Medal className="w-10 h-10 text-amber-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-1">季軍</p>
              <p className="font-display font-bold text-lg">
                {leaderboard?.[2]?.teamName || "—"}
              </p>
              <p className="font-number text-2xl text-amber-600">
                {leaderboard?.[2]?.totalScore || 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" data-testid="tab-all">全部遊戲</TabsTrigger>
            <TabsTrigger value="today" data-testid="tab-today">今日</TabsTrigger>
            <TabsTrigger value="week" data-testid="tab-week">本週</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-display">全部排名</CardTitle>
                  <Badge variant="outline" className="font-number">
                    {leaderboard?.length || 0} 位玩家
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <div
                        key={entry.id}
                        className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${getRankColor(index + 1)}`}
                        data-testid={`leaderboard-entry-${index}`}
                      >
                        <div className="w-8 h-8 flex items-center justify-center">
                          {getRankIcon(index + 1)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{entry.teamName}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {entry.completionTimeSeconds ? formatTime(entry.completionTimeSeconds) : "—"}
                            </span>
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-number text-lg font-bold text-primary">
                            {entry.totalScore}
                          </p>
                          <p className="text-xs text-muted-foreground">分數</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Trophy className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">目前沒有排行榜資料</p>
                    <p className="text-sm text-muted-foreground">完成遊戲後即可上榜</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="today">
            <Card>
              <CardContent className="p-12 text-center">
                <Flame className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">今日排行榜</p>
                <p className="text-sm text-muted-foreground">即將推出</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="week">
            <Card>
              <CardContent className="p-12 text-center">
                <Star className="w-12 h-12 text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">本週排行榜</p>
                <p className="text-sm text-muted-foreground">即將推出</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
