// 公開 Squad 分享頁 — 任何人都能看
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §15
//
// URL: /squad/:squadId
//
// 顯示：
//   - 隊伍 header（名稱、tag、隊徽）
//   - 跨遊戲統計（場次、體驗點、跨域數）
//   - 各遊戲段位 ratings
//   - 近期戰績清單
//   - 「加入這個隊伍」CTA（未加入者）
//
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { tierBadgeClass } from "@/lib/battle-labels";
import { formatTimeAgo } from "@/lib/battle-time";
import {
  Trophy, Swords, MapPin, Star, Flame, Crown,
  Users, TrendingUp, TrendingDown, Sparkles, Share2,
  Image as ImageIcon, Settings,
} from "lucide-react";

interface SquadStatsResponse {
  stats: {
    squadId: string;
    totalGames: number;
    totalGamesRaw: number;
    totalWins: number;
    totalLosses: number;
    totalDraws: number;
    totalExpPoints: number;
    fieldsPlayed: string[];
    recruitsCount: number;
    superLeaderTier?: string | null;
    squadStatus: string;
    lastActiveAt?: string;
  } | null;
  ratings: Array<{
    gameType: string;
    rating: number;
    tier: string;
    gamesPlayed: number;
    wins: number;
    losses: number;
    winStreak: number;
    peakRating: number;
  }>;
}

interface MatchRecord {
  id: string;
  gameType: string;
  result: string;
  ratingChange: number;
  isCrossField: boolean;
  isFirstVisit: boolean;
  performance: Record<string, unknown>;
  playedAt: string;
  fieldId: string;
}

const GAME_TYPE_LABEL: Record<string, { label: string; emoji: string }> = {
  battle: { label: "水彈對戰", emoji: "💧" },
  adventure: { label: "冒險遊戲", emoji: "🗺️" },
  competitive: { label: "競技通關", emoji: "⚔️" },
  relay: { label: "接力賽", emoji: "🏃" },
  puzzle: { label: "解謎", emoji: "🧩" },
  experience: { label: "純體驗", emoji: "🎉" },
};

export default function SquadPublic() {
  const [, params] = useRoute("/squad/:squadId");
  const squadId = params?.squadId ?? "";

  const { data: statsResp, isLoading: statsLoading } = useQuery<SquadStatsResponse>({
    queryKey: ["/api/squads", squadId, "stats"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/squads/${squadId}/stats`);
      return res.json();
    },
    enabled: !!squadId,
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<MatchRecord[]>({
    queryKey: ["/api/squads", squadId, "records"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/squads/${squadId}/records?limit=20`);
      return res.json();
    },
    enabled: !!squadId,
  });

  // 🆕 Phase 16.2：紀念照集錦
  const { data: photosResp } = useQuery<{
    photos: Array<{
      url: string;
      sessionId: string;
      gameType?: string;
      playedAt?: string;
    }>;
    total: number;
  }>({
    queryKey: ["/api/squads", squadId, "photos"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/squads/${squadId}/photos?limit=12`);
      return res.json();
    },
    enabled: !!squadId,
  });
  const photos = photosResp?.photos ?? [];

  const handleShare = async () => {
    const url = window.location.href;
    const title = `來看看「${squadId}」這支隊伍的戰績！`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      alert("已複製分享連結！");
    } catch {
      // ignore abort
    }
  };

  if (statsLoading || recordsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!statsResp?.stats) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="mb-3">這支隊伍還沒戰績</p>
            <p className="text-xs text-muted-foreground mb-4">
              組隊玩第一場遊戲就會顯示在這裡
            </p>
            <Link href="/battle">
              <Button>前往對戰中心</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = statsResp.stats;
  const ratings = statsResp.ratings ?? [];
  const winRate =
    stats.totalGamesRaw > 0
      ? Math.round((stats.totalWins / stats.totalGamesRaw) * 100)
      : 0;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <Card className="bg-primary/5 border-primary/30">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-7 w-7 text-primary" />
                <h1 className="text-2xl font-bold truncate">{squadId}</h1>
                {stats.superLeaderTier && (
                  <Badge variant="default" className="text-xs gap-1">
                    <Crown className="h-3 w-3" />
                    {stats.superLeaderTier}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {stats.squadStatus === "active" ? (
                  <span className="text-green-500">● 活躍中</span>
                ) : stats.squadStatus === "dormant" ? (
                  <span className="text-muted-foreground">○ 休眠中</span>
                ) : (
                  stats.squadStatus
                )}
                {stats.lastActiveAt && (
                  <span className="text-muted-foreground ml-2">
                    · 最近 {formatTimeAgo(new Date(stats.lastActiveAt))}
                  </span>
                )}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleShare} className="gap-1.5">
              <Share2 className="h-4 w-4" />
              分享
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 跨遊戲統計 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            跨遊戲總成績
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 text-center">
            <div>
              <p className="text-xs text-muted-foreground">總場次</p>
              <p className="text-2xl font-number font-bold">{stats.totalGames}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">勝</p>
              <p className="text-xl font-number font-bold text-green-500">{stats.totalWins}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">負</p>
              <p className="text-xl font-number font-bold text-red-500">{stats.totalLosses}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">勝率</p>
              <p className="text-xl font-number font-bold">{winRate}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-0.5">
                <MapPin className="h-3 w-3" /> 場域
              </p>
              <p className="text-xl font-number font-bold text-primary">{stats.fieldsPlayed.length}</p>
            </div>
          </div>
          {/* 體驗點數 */}
          <div className="mt-3 pt-3 border-t flex items-center justify-center gap-2 text-sm">
            <Sparkles className="h-3.5 w-3.5 text-orange-500" />
            <span className="text-muted-foreground">體驗點數：</span>
            <span className="font-number font-bold">{stats.totalExpPoints}</span>
          </div>
        </CardContent>
      </Card>

      {/* 各遊戲段位 */}
      {ratings.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Trophy className="h-4 w-4 text-yellow-500" />
              各遊戲段位
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ratings.map((r) => {
              const info = GAME_TYPE_LABEL[r.gameType] ?? {
                label: r.gameType,
                emoji: "🎮",
              };
              return (
                <div
                  key={r.gameType}
                  className="flex items-center justify-between p-3 rounded border bg-card"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{info.emoji}</span>
                    <div>
                      <p className="font-medium text-sm">{info.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.gamesPlayed} 場 ·{" "}
                        {r.gamesPlayed > 0 ? Math.round((r.wins / r.gamesPlayed) * 100) : 0}% 勝率
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge className={tierBadgeClass(r.tier) || "bg-muted"}>
                      {r.tier}
                    </Badge>
                    <p className="text-lg font-number font-bold mt-1">{r.rating}</p>
                    {r.peakRating > r.rating && (
                      <p className="text-[10px] text-muted-foreground">
                        峰值 {r.peakRating}
                      </p>
                    )}
                    {r.winStreak > 0 && (
                      <p className="text-xs text-orange-500 flex items-center gap-0.5 justify-end">
                        <Flame className="h-3 w-3" />
                        {r.winStreak} 連勝
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 近期戰績 */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Swords className="h-4 w-4" />
              近期戰績（{records.length}）
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {records.map((r) => {
              const info = GAME_TYPE_LABEL[r.gameType] ?? {
                label: r.gameType,
                emoji: "🎮",
              };
              return (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 text-sm border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span>{info.emoji}</span>
                    <Badge
                      variant={
                        r.result === "win" || r.result === "completed"
                          ? "default"
                          : r.result === "loss" || r.result === "failed"
                            ? "destructive"
                            : "outline"
                      }
                      className="text-[10px]"
                    >
                      {r.result}
                    </Badge>
                    {r.isFirstVisit && (
                      <Badge variant="outline" className="text-[10px]">
                        🚀 首航
                      </Badge>
                    )}
                    {r.isCrossField && !r.isFirstVisit && (
                      <Badge variant="outline" className="text-[10px]">
                        🏞️ 跨域
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    {r.ratingChange > 0 ? (
                      <span className="text-green-500 font-number flex items-center gap-0.5">
                        <TrendingUp className="h-3 w-3" />+{r.ratingChange}
                      </span>
                    ) : r.ratingChange < 0 ? (
                      <span className="text-red-500 font-number flex items-center gap-0.5">
                        <TrendingDown className="h-3 w-3" />
                        {r.ratingChange}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {formatTimeAgo(new Date(r.playedAt))}
                    </span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* CTA */}
      <Card className="border-dashed">
        <CardContent className="p-6 text-center space-y-3">
          <Star className="h-8 w-8 mx-auto text-primary" />
          <p className="font-medium">想加入這支隊伍？</p>
          <p className="text-xs text-muted-foreground">
            到組隊大廳輸入邀請碼，或請隊長分享連結給你
          </p>
          <Link href="/battle">
            <Button className="gap-2">
              <Users className="h-4 w-4" />
              前往對戰中心
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
