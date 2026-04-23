// 🏆 排行榜頁 — 顯示玩家頭像、暱稱、匿名標記
import { useState } from "react";
import { Link } from "wouter";
import { useFieldLink } from "@/hooks/useFieldLink";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { LeaderboardEntry, Game } from "@shared/schema";
import {
  Trophy, Medal, Clock, ArrowLeft, Crown,
  Flame, Star, UserX,
} from "lucide-react";
import { useCurrentField } from "@/providers/FieldThemeProvider";

/** 擴充版 leaderboard entry（server 回傳） */
interface LeaderboardEntryExtended extends LeaderboardEntry {
  displayName: string;
  isAnonymousDisplay: boolean;
  profileImageUrl: string | null;
}

export default function Leaderboard() {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  // 🔒 場域隔離：排行榜只顯示當前場域的資料
  const currentField = useCurrentField();
  const currentFieldCode = currentField?.code;

  const gamesQueryKey = currentFieldCode
    ? [`/api/games?fieldCode=${currentFieldCode}`]
    : ["/api/games"];
  const { data: games } = useQuery<Game[]>({
    queryKey: gamesQueryKey,
  });

  const leaderboardQueryKey = (() => {
    const params = new URLSearchParams();
    if (selectedGame) params.set("gameId", selectedGame);
    if (currentFieldCode) params.set("fieldCode", currentFieldCode);
    const qs = params.toString();
    return qs ? [`/api/leaderboard?${qs}`] : ["/api/leaderboard"];
  })();
  const { data: leaderboard, isLoading: leaderboardLoading } = useQuery<LeaderboardEntryExtended[]>({
    queryKey: leaderboardQueryKey,
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

  const getInitials = (entry: LeaderboardEntryExtended): string => {
    const name = entry.displayName || entry.teamName || "?";
    return name.slice(0, 2).toUpperCase();
  };

  // 計算匿名玩家比例（提示用）
  const anonymousCount = leaderboard?.filter((e) => e.isAnonymousDisplay).length ?? 0;
  const anonymousRatio = leaderboard && leaderboard.length > 0
    ? Math.round((anonymousCount / leaderboard.length) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href={link("/home")}>
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
        {/* 前三名大卡 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <PodiumCard
            rank={1}
            entry={leaderboard?.[0]}
            getInitials={getInitials}
          />
          <PodiumCard
            rank={2}
            entry={leaderboard?.[1]}
            getInitials={getInitials}
          />
          <PodiumCard
            rank={3}
            entry={leaderboard?.[2]}
            getInitials={getInitials}
          />
        </div>

        {/* 遊戲篩選 */}
        {games && games.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={selectedGame === null ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGame(null)}
                data-testid="filter-game-all"
              >
                全部遊戲
              </Button>
              {games.map((g) => (
                <Button
                  key={g.id}
                  variant={selectedGame === g.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedGame(g.id)}
                  data-testid={`filter-game-${g.id}`}
                  className="max-w-[160px] truncate"
                >
                  {g.title}
                </Button>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" data-testid="tab-all">全部排名</TabsTrigger>
            <TabsTrigger value="today" data-testid="tab-today">今日</TabsTrigger>
            <TabsTrigger value="week" data-testid="tab-week">本週</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg font-display">排行榜</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {anonymousRatio > 0 && (
                      <Badge variant="outline" className="gap-1 border-amber-500/50 text-amber-600">
                        <UserX className="w-3 h-3" />
                        {anonymousCount} 位匿名（{anonymousRatio}%）
                      </Badge>
                    )}
                    <Badge variant="outline" className="font-number">
                      {leaderboard?.length || 0} 位玩家
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {leaderboardLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <Skeleton className="h-4 flex-1" />
                        <Skeleton className="h-4 w-16" />
                      </div>
                    ))}
                  </div>
                ) : leaderboard && leaderboard.length > 0 ? (
                  <div className="space-y-2">
                    {leaderboard.map((entry, index) => (
                      <LeaderboardRow
                        key={entry.id}
                        entry={entry}
                        rank={index + 1}
                        getRankIcon={getRankIcon}
                        getRankColor={getRankColor}
                        getInitials={getInitials}
                        formatTime={formatTime}
                      />
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

// ──────────────────────────────────────────────────────────────
// 子元件
// ──────────────────────────────────────────────────────────────

/** 前三名大卡片 */
function PodiumCard({
  rank,
  entry,
  getInitials,
}: {
  rank: 1 | 2 | 3;
  entry?: LeaderboardEntryExtended;
  getInitials: (e: LeaderboardEntryExtended) => string;
}) {
  const styles = {
    1: {
      wrapper: "bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border-yellow-500/30",
      icon: <Crown className="w-10 h-10 text-yellow-500" />,
      title: "冠軍",
      scoreColor: "text-yellow-500",
    },
    2: {
      wrapper: "bg-gradient-to-br from-gray-400/10 to-gray-500/5 border-gray-400/30",
      icon: <Medal className="w-10 h-10 text-gray-400" />,
      title: "亞軍",
      scoreColor: "text-gray-400",
    },
    3: {
      wrapper: "bg-gradient-to-br from-amber-600/10 to-amber-700/5 border-amber-600/30",
      icon: <Medal className="w-10 h-10 text-amber-600" />,
      title: "季軍",
      scoreColor: "text-amber-600",
    },
  }[rank];

  return (
    <Card className={styles.wrapper}>
      <CardContent className="p-6 text-center">
        <div className="mb-2 flex items-center justify-center">{styles.icon}</div>
        <p className="text-sm text-muted-foreground mb-2">{styles.title}</p>
        {entry ? (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Avatar className="w-9 h-9">
                {entry.profileImageUrl && <AvatarImage src={entry.profileImageUrl} />}
                <AvatarFallback className="text-sm">{getInitials(entry)}</AvatarFallback>
              </Avatar>
              <p className="font-display font-bold text-lg truncate max-w-[140px]" title={entry.displayName}>
                {entry.displayName}
              </p>
            </div>
            {entry.isAnonymousDisplay && (
              <Badge variant="outline" className="text-[10px] border-amber-500/50 text-amber-600 mb-1">
                匿名
              </Badge>
            )}
            <p className={`font-number text-2xl ${styles.scoreColor}`}>{entry.totalScore || 0}</p>
          </>
        ) : (
          <>
            <p className="font-display font-bold text-lg">—</p>
            <p className={`font-number text-2xl ${styles.scoreColor}`}>0</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** 一般排名列 */
function LeaderboardRow({
  entry,
  rank,
  getRankIcon,
  getRankColor,
  getInitials,
  formatTime,
}: {
  entry: LeaderboardEntryExtended;
  rank: number;
  getRankIcon: (r: number) => React.ReactNode;
  getRankColor: (r: number) => string;
  getInitials: (e: LeaderboardEntryExtended) => string;
  formatTime: (s: number) => string;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${getRankColor(rank)}`}
      data-testid={`leaderboard-entry-${rank}`}
    >
      <div className="w-8 h-8 flex items-center justify-center shrink-0">
        {getRankIcon(rank)}
      </div>

      {/* 頭像 */}
      <Avatar className="w-10 h-10 shrink-0">
        {entry.profileImageUrl && <AvatarImage src={entry.profileImageUrl} />}
        <AvatarFallback className={entry.isAnonymousDisplay ? "bg-amber-100 dark:bg-amber-900/30" : ""}>
          {entry.isAnonymousDisplay ? <UserX className="w-4 h-4 text-amber-500" /> : getInitials(entry)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium truncate">{entry.displayName}</p>
          {entry.isAnonymousDisplay && (
            <Badge variant="outline" className="text-[9px] h-4 px-1 border-amber-500/50 text-amber-600 shrink-0">
              匿名
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
          {entry.teamName && entry.teamName !== entry.displayName && (
            <span className="truncate max-w-[140px]" title={entry.teamName}>
              {entry.teamName}
            </span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {entry.completionTimeSeconds ? formatTime(entry.completionTimeSeconds) : "—"}
          </span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="font-number text-lg font-bold text-primary">{entry.totalScore}</p>
        <p className="text-xs text-muted-foreground">分數</p>
      </div>
    </div>
  );
}
