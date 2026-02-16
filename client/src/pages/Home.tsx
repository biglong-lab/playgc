import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/firebase";
import type { Game, GameSession } from "@shared/schema";
import {
  Gamepad2, Clock, Users, Zap, Search, Filter,
  Star, MapPin, Trophy, Play, LogOut, RotateCcw, CheckCircle2
} from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";

interface UserGameStatus {
  gameId: string;
  status: "playing" | "completed";
  sessionId: string;
  score: number;
}

export default function Home() {
  const { user, firebaseUser, isLoading: authLoading, isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState<string | null>(null);

  const { data: games, isLoading: gamesLoading } = useQuery<Game[]>({
    queryKey: ["/api/games"],
  });

  const { data: userSessions } = useQuery<GameSession[]>({
    queryKey: ["/api/sessions"],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch("/api/sessions", {
        credentials: 'include',
        headers,
      });
      if (response.ok) {
        return response.json();
      }
      return [];
    },
    enabled: !!user,
  });

  const gameStatusMap = new Map<string, UserGameStatus>();
  if (userSessions) {
    userSessions.forEach(session => {
      if (!session.gameId) return;
      if (session.status === "playing" || session.status === "completed") {
        const existing = gameStatusMap.get(session.gameId);
        if (!existing || (session.status === "playing" && existing.status === "completed")) {
          gameStatusMap.set(session.gameId, {
            gameId: session.gameId,
            status: session.status as "playing" | "completed",
            sessionId: session.id,
            score: session.score || 0,
          });
        }
      }
    });
  }

  const handleSignOut = async () => {
    await signOut();
    setLocation("/");
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">載入中...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    setLocation("/");
    return null;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">同步用戶資料...</p>
        </div>
      </div>
    );
  }

  const filteredGames = games?.filter(game => {
    const matchesSearch = game.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      game.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDifficulty = !difficultyFilter || game.difficulty === difficultyFilter;
    return matchesSearch && matchesDifficulty;
  });

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "bg-success/20 text-success border-success/30";
      case "medium": return "bg-warning/20 text-warning border-warning/30";
      case "hard": return "bg-destructive/20 text-destructive border-destructive/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case "easy": return "簡單";
      case "medium": return "中等";
      case "hard": return "困難";
      default: return difficulty;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <Gamepad2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="font-display font-bold text-lg">賈村競技場</h1>
                <p className="text-xs text-muted-foreground">遊戲大廳</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Link href="/leaderboard">
                <Button variant="ghost" size="sm" className="gap-2" data-testid="link-leaderboard">
                  <Trophy className="w-4 h-4" />
                  <span className="hidden sm:inline">排行榜</span>
                </Button>
              </Link>
              
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium hidden sm:inline">
                  {user.firstName || user.email?.split("@")[0] || "玩家"}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={firebaseUser?.photoURL || user.profileImageUrl || undefined} />
                        <AvatarFallback>
                          {(user.firstName?.[0] || user.email?.[0] || "U").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleSignOut} data-testid="button-signout">
                      <LogOut className="w-4 h-4 mr-2" />
                      登出
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-display font-bold mb-2">
            歡迎回來, <span className="text-primary">{user.firstName || "玩家"}</span>
          </h2>
          <p className="text-muted-foreground">選擇一個任務開始你的冒險</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜尋遊戲..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-games"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={difficultyFilter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter(null)}
              data-testid="filter-all"
            >
              全部
            </Button>
            <Button
              variant={difficultyFilter === "easy" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("easy")}
              className={difficultyFilter === "easy" ? "" : "text-success border-success/30"}
              data-testid="filter-easy"
            >
              簡單
            </Button>
            <Button
              variant={difficultyFilter === "medium" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("medium")}
              className={difficultyFilter === "medium" ? "" : "text-warning border-warning/30"}
              data-testid="filter-medium"
            >
              中等
            </Button>
            <Button
              variant={difficultyFilter === "hard" ? "default" : "outline"}
              size="sm"
              onClick={() => setDifficultyFilter("hard")}
              className={difficultyFilter === "hard" ? "" : "text-destructive border-destructive/30"}
              data-testid="filter-hard"
            >
              困難
            </Button>
          </div>
        </div>

        {gamesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <CardContent className="p-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredGames && filteredGames.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGames.map((game) => (
              <Card
                key={game.id}
                className="overflow-hidden group hover-elevate cursor-pointer"
                onClick={() => {
                  if (game.gameStructure === "chapters") {
                    setLocation(`/game/${game.id}/chapters`);
                  } else if (game.gameMode === "competitive" || game.gameMode === "relay") {
                    setLocation(`/match/${game.id}`);
                  } else if (game.gameMode === "team") {
                    setLocation(`/team/${game.id}`);
                  } else {
                    setLocation(`/game/${game.id}`);
                  }
                }}
                data-testid={`card-game-${game.id}`}
              >
                <div className="relative h-48 bg-card overflow-hidden">
                  {game.coverImageUrl ? (
                    <img
                      src={game.coverImageUrl}
                      alt={game.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        target.parentElement?.classList.add('cover-fallback');
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center ${game.coverImageUrl ? 'absolute inset-0 -z-10' : ''}`}>
                    <Gamepad2 className="w-16 h-16 text-primary/50" />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  <Badge 
                    className={`absolute top-3 right-3 ${getDifficultyColor(game.difficulty || "medium")}`}
                  >
                    {getDifficultyLabel(game.difficulty || "medium")}
                  </Badge>
                </div>
                
                <CardContent className="p-4">
                  <h3 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                    {game.title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {game.description || "無描述"}
                  </p>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{game.estimatedTime || 30} 分鐘</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {game.gameMode === "team" ? (
                        <span>{game.minTeamPlayers || 2}-{game.maxTeamPlayers || 6} 人組隊</span>
                      ) : (
                        <span>最多 {game.maxPlayers || 6} 人</span>
                      )}
                    </div>
                  </div>
                </CardContent>
                
                <CardFooter className="p-4 pt-0">
                  {(() => {
                    const gameStatus = gameStatusMap.get(game.id);
                    if (gameStatus?.status === "completed") {
                      return (
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-center gap-2 text-success py-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm font-medium">遊戲已完成 - {gameStatus.score} 分</span>
                          </div>
                          <Button 
                            variant="outline" 
                            className="w-full gap-2" 
                            data-testid={`button-replay-game-${game.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setLocation(game.gameMode === "team" ? `/team/${game.id}` : `/game/${game.id}?replay=true`);
                            }}
                          >
                            <RotateCcw className="w-4 h-4" />
                            {game.gameMode === "team" ? "重新組隊" : "再玩一次"}
                          </Button>
                        </div>
                      );
                    } else if (gameStatus?.status === "playing") {
                      return (
                        <Button className="w-full gap-2 bg-warning text-warning-foreground hover:bg-warning/90" data-testid={`button-continue-game-${game.id}`}>
                          <Play className="w-4 h-4" />
                          {game.gameMode === "team" ? "返回隊伍" : "返回遊戲"}
                        </Button>
                      );
                    } else {
                      return (
                        <Button className="w-full gap-2" data-testid={`button-start-game-${game.id}`}>
                          {game.gameMode === "team" ? <Users className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {game.gameMode === "team" ? "創建或加入隊伍" : "開始遊戲"}
                        </Button>
                      );
                    }
                  })()}
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-display font-bold mb-2">
              {searchQuery || difficultyFilter ? "找不到符合的遊戲" : "目前沒有可用的遊戲"}
            </h3>
            <p className="text-muted-foreground">
              {searchQuery || difficultyFilter ? "嘗試調整搜尋條件" : "請稍後再回來查看"}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
