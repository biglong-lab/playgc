// 水彈對戰 PK 擂台 — 玩家端賽季歷史（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useBattleFieldId } from "@/hooks/useBattleFieldId";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tierLabels } from "@shared/schema";
import BattleLayout from "@/components/battle/BattleLayout";
import { Trophy, Medal } from "lucide-react";

interface SeasonHistoryEntry {
  id: string;
  seasonId: string;
  finalRating: number;
  finalTier: string;
  tierLabel: string;
  totalBattles: number;
  wins: number;
  losses: number;
  draws: number;
  rank: number;
  seasonName: string;
  seasonNumber: number;
  startDate: string;
  endDate: string | null;
}

const tierColors: Record<string, string> = {
  bronze: "bg-orange-500/20 text-orange-400",
  silver: "bg-gray-500/20 text-gray-300",
  gold: "bg-yellow-500/20 text-yellow-400",
  platinum: "bg-cyan-500/20 text-cyan-400",
  diamond: "bg-blue-500/20 text-blue-400",
  master: "bg-purple-500/20 text-purple-400",
};

export default function BattleSeasonHistory() {
  const { user } = useAuth();

  const { data: history = [], isLoading } = useQuery<SeasonHistoryEntry[]>({
    queryKey: ["/api/battle/my/season-history"],
    queryFn: async () => {
      const res = await fetch("/api/battle/my/season-history?fieldId=default", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  return (
    <BattleLayout title="賽季歷史" subtitle="歷屆賽季排名紀錄" backHref="/battle/my">
      <div className="space-y-4">
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">載入中...</p>
        ) : history.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">尚無賽季紀錄</p>
              <p className="text-xs text-muted-foreground mt-1">
                參加對戰累積排名，賽季結束時會保存紀錄
              </p>
            </CardContent>
          </Card>
        ) : (
          history.map((entry) => (
            <Card key={entry.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-display font-semibold">{entry.seasonName}</h3>
                    <p className="text-xs text-muted-foreground">
                      第 {entry.seasonNumber} 賽季 ·{" "}
                      {new Date(entry.startDate).toLocaleDateString("zh-TW")}
                      {entry.endDate && ` ~ ${new Date(entry.endDate).toLocaleDateString("zh-TW")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {entry.rank <= 3 && (
                      <Medal className={`h-5 w-5 ${
                        entry.rank === 1 ? "text-yellow-500" :
                        entry.rank === 2 ? "text-gray-400" :
                        "text-amber-700"
                      }`} />
                    )}
                    <span className="text-lg font-number font-bold">#{entry.rank}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`${tierColors[entry.finalTier] ?? ""}`}>
                    {tierLabels[entry.finalTier as keyof typeof tierLabels] ?? entry.finalTier}
                  </Badge>
                  <span className="text-lg font-number font-bold">{entry.finalRating} 分</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">總場</p>
                    <p className="font-number font-semibold">{entry.totalBattles}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">勝</p>
                    <p className="font-number font-semibold text-green-500">{entry.wins}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">負</p>
                    <p className="font-number font-semibold text-red-500">{entry.losses}</p>
                  </div>
                  <div className="bg-primary/5 rounded p-2">
                    <p className="text-xs text-muted-foreground">平</p>
                    <p className="font-number font-semibold">{entry.draws}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </BattleLayout>
  );
}
