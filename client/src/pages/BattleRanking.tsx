// 水彈對戰 PK 擂台 — 排行榜（深色軍事風格）
// 🆕 Phase 2.1：4 Tabs 架構（場次榜 / 新人榜 / 上升星 / 段位）
import { useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { apiRequest } from "@/lib/queryClient";
import { tierBgClass } from "@/lib/battle-labels";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerRanking } from "@shared/schema";
import { Crown, Flame, ArrowDown, TrendingUp, Sparkles, Rocket, Trophy } from "lucide-react";

interface RankingEntry extends BattlePlayerRanking {
  rank: number;
  tierLabel: string;
  winRate: number;
  displayName?: string;
}

export default function BattleRanking() {
  const { user } = useAuth();
  const { fieldId } = useBattleFieldId();

  const { data: rankings = [], isLoading } = useQuery<RankingEntry[]>({
    queryKey: ["/api/battle/rankings", fieldId],
    queryFn: async () => {
      if (!fieldId) return [];
      try {
        const res = await apiRequest("GET", `/api/battle/rankings?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!fieldId,
  });

  const { data: myRanking } = useQuery<RankingEntry>({
    queryKey: ["/api/battle/rankings/me", fieldId],
    queryFn: async () => {
      if (!fieldId) return null;
      try {
        const res = await apiRequest("GET", `/api/battle/rankings/me?fieldId=${fieldId}`);
        return res.json();
      } catch {
        return null;
      }
    },
    enabled: !!fieldId && !!user,
  });

  // 🔧 找到自己在 list 中的位置（用來算上一名距離 + scrollIntoView）
  const myEntryRef = useRef<HTMLDivElement | null>(null);
  const myIndex = user ? rankings.findIndex((e) => e.userId === user.id) : -1;
  const myEntry = myIndex >= 0 ? rankings[myIndex] : null;
  const prevEntry = myIndex > 0 ? rankings[myIndex - 1] : null;
  const ratingGap = prevEntry && myEntry ? prevEntry.rating - myEntry.rating : 0;

  // 🆕 Phase 2.1：4 種榜的衍生資料（從現有 rankings 推算，Phase 4 將改為真實 squad_match_records）
  const gamesRanking = useMemo(() => {
    return [...rankings]
      .sort((a, b) => (b.totalBattles ?? 0) - (a.totalBattles ?? 0))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [rankings]);

  const newbieRanking = useMemo(() => {
    return rankings
      .filter((e) => (e.totalBattles ?? 0) >= 1 && (e.totalBattles ?? 0) <= 9)
      .sort((a, b) => (b.totalBattles ?? 0) - (a.totalBattles ?? 0))
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [rankings]);

  const risingRanking = useMemo(() => {
    // Phase 4 將改用 30 天 squad_match_records 計算成長
    // 暫時用「最近活躍 + 中等場次」估算上升中
    return rankings
      .filter((e) => (e.totalBattles ?? 0) >= 5 && (e.totalBattles ?? 0) <= 50)
      .sort((a, b) => (b.winStreak ?? 0) - (a.winStreak ?? 0))
      .slice(0, 20)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [rankings]);

  // 「滾到我的位置」 —— 排名在第 6 名以後才顯示
  const showScrollToMe = myIndex >= 5;
  const scrollToMe = () => {
    myEntryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <BattleLayout title="排行榜" subtitle="全場域積分排名">
      <div className="space-y-4">
        {/* 我的排名 */}
        {myRanking && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">我的段位</p>
                  <p className="text-xl font-display font-bold">
                    {myRanking.tierLabel}
                    {/* 🚀 顯示排名 */}
                    {myEntry && (
                      <span className="ml-2 text-sm text-muted-foreground font-normal">
                        #{myEntry.rank}
                      </span>
                    )}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-number font-bold">{myRanking.rating}</p>
                  <p className="text-sm text-muted-foreground">積分</p>
                </div>
              </div>
              {/* 🚀 距離下一名提示（提供向上挑戰動力） */}
              {prevEntry && ratingGap > 0 && (
                <div className="mt-2 flex items-center justify-center gap-1.5 text-xs">
                  <TrendingUp className="h-3 w-3 text-primary" />
                  <span className="text-muted-foreground">距離 #{prevEntry.rank} </span>
                  <span className="font-semibold text-primary">{prevEntry.displayName ?? "玩家"}</span>
                  <span className="text-muted-foreground">還差</span>
                  <span className="font-number font-bold text-primary">{ratingGap}</span>
                  <span className="text-muted-foreground">分</span>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-center text-sm">
                <div>
                  <p className="text-muted-foreground">總場</p>
                  <p className="font-number font-semibold">{myRanking.totalBattles}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">勝率</p>
                  <p className="font-number font-semibold">{myRanking.winRate}%</p>
                </div>
                <div>
                  <p className="text-muted-foreground">連勝</p>
                  <p className="font-number font-semibold flex items-center justify-center gap-1">
                    {myRanking.winStreak > 0 && <Flame className="h-3 w-3 text-orange-500" />}
                    {myRanking.winStreak}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">MVP</p>
                  <p className="font-number font-semibold">{myRanking.mvpCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 🆕 Phase 2.1：4 Tabs 排行榜（場次榜為主） */}
        <Tabs defaultValue="games" className="w-full">
          <TabsList className="grid grid-cols-4 w-full">
            <TabsTrigger value="games" className="gap-1.5">
              <Flame className="h-3.5 w-3.5" />
              場次榜
            </TabsTrigger>
            <TabsTrigger value="newbie" className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              新人榜
            </TabsTrigger>
            <TabsTrigger value="rising" className="gap-1.5">
              <Rocket className="h-3.5 w-3.5" />
              上升星
            </TabsTrigger>
            <TabsTrigger value="tier" className="gap-1.5">
              <Trophy className="h-3.5 w-3.5" />
              段位
            </TabsTrigger>
          </TabsList>

          {/* 🔥 場次榜（主榜，預設顯示）— Phase 4 將串 squad_match_records 真實場次 */}
          <TabsContent value="games">
            <RankingList
              title="🔥 場次榜（活躍隊伍）"
              subtitle="跨遊戲統一場次，最公平的活躍度指標"
              entries={gamesRanking}
              isLoading={isLoading}
              userId={user?.id}
              myEntryRef={myEntryRef}
              showScrollToMe={showScrollToMe}
              onScrollToMe={scrollToMe}
              metric="games"
              emptyText="尚無活躍隊伍"
            />
          </TabsContent>

          {/* 🌱 新人榜（1-9 場）— 給新隊伍上榜舞台 */}
          <TabsContent value="newbie">
            <RankingList
              title="🌱 新人榜"
              subtitle="第一次組隊就有機會上榜"
              entries={newbieRanking}
              isLoading={isLoading}
              userId={user?.id}
              myEntryRef={null}
              showScrollToMe={false}
              onScrollToMe={() => {}}
              metric="newbie"
              emptyText="目前還沒有新人隊伍 — 你可以是第一個！"
            />
          </TabsContent>

          {/* ⚡ 上升星榜 — 30 天成長最快 */}
          <TabsContent value="rising">
            <RankingList
              title="⚡ 上升星"
              subtitle="本月成長最快的黑馬隊伍"
              entries={risingRanking}
              isLoading={isLoading}
              userId={user?.id}
              myEntryRef={null}
              showScrollToMe={false}
              onScrollToMe={() => {}}
              metric="rising"
              emptyText="尚無成長資料 — 多打幾場就會出現！"
            />
          </TabsContent>

          {/* 🏆 段位榜 — 各遊戲類型獨立 rating */}
          <TabsContent value="tier">
            <RankingList
              title="🏆 段位榜"
              subtitle="水彈對戰 ELO rating 排序"
              entries={rankings}
              isLoading={isLoading}
              userId={user?.id}
              myEntryRef={myEntryRef}
              showScrollToMe={showScrollToMe}
              onScrollToMe={scrollToMe}
              metric="tier"
              emptyText="尚無段位資料"
            />
          </TabsContent>
        </Tabs>
      </div>
    </BattleLayout>
  );
}

// ============================================================================
// 共用排行榜列表元件（4 個 tab 都用這個）
// ============================================================================
interface RankingListProps {
  title: string;
  subtitle: string;
  entries: RankingEntry[];
  isLoading: boolean;
  userId?: string;
  myEntryRef: React.RefObject<HTMLDivElement> | null;
  showScrollToMe: boolean;
  onScrollToMe: () => void;
  metric: "games" | "newbie" | "rising" | "tier";
  emptyText: string;
}

function RankingList({
  title, subtitle, entries, isLoading, userId,
  myEntryRef, showScrollToMe, onScrollToMe, metric, emptyText,
}: RankingListProps) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
        {showScrollToMe && (
          <Button variant="outline" size="sm" onClick={onScrollToMe} className="gap-1 text-xs h-7">
            <ArrowDown className="h-3 w-3" />
            定位到我
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">{emptyText}</p>
        ) : (
          <div className="space-y-2">
            {entries.map((entry) => (
              <div
                key={entry.id}
                ref={entry.userId === userId ? myEntryRef ?? undefined : undefined}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  tierBgClass(entry.tier) || "bg-card"
                } ${entry.userId === userId ? "ring-2 ring-primary scroll-mt-20" : ""}`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 text-center font-bold text-lg">
                    {entry.rank <= 3 ? (
                      <Crown className={`h-5 w-5 mx-auto ${
                        entry.rank === 1 ? "text-yellow-500" :
                        entry.rank === 2 ? "text-gray-400" :
                        "text-orange-400"
                      }`} />
                    ) : (
                      <span className="text-muted-foreground font-number">{entry.rank}</span>
                    )}
                  </span>
                  <div>
                    <p className="font-medium text-sm">
                      {entry.displayName ?? entry.userId.slice(0, 10)}
                      {entry.userId === userId && <span className="text-primary"> (你)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {metric === "tier" && entry.tierLabel}
                      {metric === "games" && `${entry.totalBattles ?? 0} 場 · 勝率 ${entry.winRate}%`}
                      {metric === "newbie" && `${entry.totalBattles ?? 0}/9 場（新人區）`}
                      {metric === "rising" && `本月成長中`}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {metric === "tier" ? (
                    <>
                      <p className="font-number font-bold">{entry.rating}</p>
                      <p className="text-xs text-muted-foreground font-number">
                        {entry.wins}勝 {entry.losses}負 ({entry.winRate}%)
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-number font-bold flex items-center gap-1">
                        <Flame className="h-3.5 w-3.5 text-orange-500" />
                        {entry.totalBattles ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">場次</p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
