// Squad 6 個排行榜頁 — Phase 12.2
// 詳見 docs/SQUAD_SYSTEM_DESIGN.md §8
//
// URL: /squads/leaderboards
//
// 6 個 Tab：場次榜 / 名人堂 / 新人榜 / 上升星 / 各遊戲段位 / 常客榜
//
import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Crown,
  Sprout,
  Zap,
  Gamepad2,
  Sparkles,
  Loader2,
} from "lucide-react";

interface SquadEntry {
  rank: number;
  squadId: string;
  squadName: string;
  squadTag: string | null;
  totalGames: number;
  totalExpPoints: number;
  monthlyGames: number;
  monthlyRecruits: number;
  recruitsCount: number;
  superLeaderTier: string | null;
  growthScore?: number;
  rating?: number;
  tier?: string;
  gamesPlayed?: number;
}

interface RatingEntry {
  rank: number;
  squadId: string;
  squadName: string;
  squadTag: string | null;
  rating: number;
  tier: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

const TABS = [
  { key: "total", label: "場次榜", icon: Flame, color: "text-orange-500" },
  { key: "hall_of_fame", label: "名人堂", icon: Crown, color: "text-amber-500" },
  { key: "newbies", label: "新人榜", icon: Sprout, color: "text-green-500" },
  { key: "rising", label: "上升星", icon: Zap, color: "text-yellow-500" },
  { key: "regulars", label: "常客榜", icon: Sparkles, color: "text-violet-500" },
  { key: "by_game", label: "段位榜", icon: Gamepad2, color: "text-blue-500" },
] as const;

const GAME_TYPES = [
  { key: "battle", label: "水彈對戰" },
  { key: "adventure", label: "冒險遊戲" },
  { key: "competitive", label: "競技通關" },
  { key: "puzzle", label: "解謎挑戰" },
];

const TIER_LABELS: Record<string, { label: string; color: string }> = {
  bronze: { label: "青銅", color: "bg-amber-700 text-white" },
  silver: { label: "白銀", color: "bg-gray-400 text-white" },
  gold: { label: "黃金", color: "bg-yellow-500 text-white" },
  platinum: { label: "白金", color: "bg-cyan-400 text-white" },
  master: { label: "宗師", color: "bg-purple-600 text-white" },
};

function rankEmoji(rank: number): string {
  if (rank === 1) return "👑";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `${rank}.`;
}

export default function SquadLeaderboards() {
  const [activeTab, setActiveTab] = useState<string>("total");
  const [activeGameType, setActiveGameType] = useState<string>("battle");

  // 一般 5 榜（不含段位）
  const { data: list, isLoading } = useQuery<{ items: SquadEntry[] }>({
    queryKey: ["/api/squads/leaderboard", activeTab],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/squads/leaderboard/${activeTab.replace("_", "-")}?limit=50`,
      );
      return res.json();
    },
    enabled: activeTab !== "by_game",
  });

  // 段位榜
  const { data: ratingList, isLoading: ratingLoading } = useQuery<{
    items: RatingEntry[];
  }>({
    queryKey: ["/api/squads/leaderboard/by-game", activeGameType],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/squads/leaderboard/by-game/${activeGameType}?limit=50`,
      );
      return res.json();
    },
    enabled: activeTab === "by_game",
  });

  return (
    <div className="container max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🏆 隊伍排行榜</h1>
        <p className="text-sm text-muted-foreground">
          6 個榜單，每隊都有舞台
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 mb-4 h-auto">
          {TABS.map((t) => (
            <TabsTrigger
              key={t.key}
              value={t.key}
              className="flex flex-col gap-1 py-2"
            >
              <t.icon className={`w-4 h-4 ${t.color}`} />
              <span className="text-[11px]">{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* 一般 5 榜 */}
        {TABS.filter((t) => t.key !== "by_game").map((t) => (
          <TabsContent key={t.key} value={t.key}>
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="p-12 text-center">
                    <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                  </div>
                ) : !list?.items?.length ? (
                  <div className="p-12 text-center text-muted-foreground">
                    <t.icon
                      className={`w-12 h-12 mx-auto mb-2 ${t.color} opacity-30`}
                    />
                    <p className="text-sm">目前沒有資料，快去打第一場吧！</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {list.items.map((entry) => (
                      <SquadRow
                        key={entry.squadId}
                        entry={entry}
                        type={t.key}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}

        {/* 段位榜（含 game type sub-tab）*/}
        <TabsContent value="by_game">
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {GAME_TYPES.map((g) => (
              <button
                key={g.key}
                onClick={() => setActiveGameType(g.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  activeGameType === g.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <Card>
            <CardContent className="p-0">
              {ratingLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
                </div>
              ) : !ratingList?.items?.length ? (
                <div className="p-12 text-center text-muted-foreground">
                  <Gamepad2 className="w-12 h-12 mx-auto mb-2 text-blue-500 opacity-30" />
                  <p className="text-sm">這個遊戲類型還沒有隊伍上榜</p>
                </div>
              ) : (
                <div className="divide-y">
                  {ratingList.items.map((entry) => (
                    <RatingRow key={entry.squadId} entry={entry} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SquadRow({ entry, type }: { entry: SquadEntry; type: string }) {
  const isSuper = ["gold", "platinum", "super"].includes(
    entry.superLeaderTier ?? "",
  );

  // 各榜單的主要指標
  let metric: { label: string; value: number | string };
  switch (type) {
    case "rising":
      metric = {
        label: "本月成長",
        value: `+${entry.monthlyGames} 場 / +${entry.monthlyRecruits} 招募`,
      };
      break;
    case "regulars":
      metric = { label: "體驗點數", value: entry.totalExpPoints };
      break;
    default:
      metric = { label: "總場次", value: entry.totalGames };
  }

  return (
    <Link
      href={`/squad/${entry.squadId}`}
      className="block p-3 hover:bg-muted/50 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 text-center font-bold text-sm">
          {rankEmoji(entry.rank)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium truncate">{entry.squadName}</span>
            {entry.squadTag && (
              <span className="text-xs text-muted-foreground font-mono">
                [{entry.squadTag}]
              </span>
            )}
            {isSuper && (
              <Badge className="bg-amber-500 text-white text-[10px]">
                <Crown className="w-2.5 h-2.5 mr-0.5" />
                超級
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {metric.label}：
            <span className="font-medium text-foreground">{metric.value}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function RatingRow({ entry }: { entry: RatingEntry }) {
  const tier = TIER_LABELS[entry.tier] ?? TIER_LABELS.silver;
  return (
    <Link
      href={`/squad/${entry.squadId}`}
      className="block p-3 hover:bg-muted/50 transition"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 text-center font-bold text-sm">
          {rankEmoji(entry.rank)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-medium truncate">{entry.squadName}</span>
            <Badge className={`text-[10px] ${tier.color}`}>{tier.label}</Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{entry.rating}</span>{" "}
            分 · {entry.gamesPlayed} 場 ({entry.wins}勝/{entry.losses}敗)
          </div>
        </div>
      </div>
    </Link>
  );
}
