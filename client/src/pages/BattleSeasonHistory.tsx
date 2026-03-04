// 水彈對戰 PK 擂台 — 玩家端賽季歷史
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tierLabels } from "@shared/schema";
import { Link } from "wouter";
import { ArrowLeft, Calendar, Trophy, Medal } from "lucide-react";

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

export default function BattleSeasonHistory() {
  const { user } = useAuth();

  // 先取得場域 ID（從排名中）
  const { data: ranking } = useQuery<{ fieldId?: string }>({
    queryKey: ["/api/battle/rankings/me-field"],
    queryFn: async () => {
      // 嘗試取得使用者的場域
      const res = await fetch("/api/battle/rankings/me?fieldId=default", {
        credentials: "include",
      });
      if (!res.ok) return {};
      return res.json();
    },
    enabled: !!user,
  });

  const { data: history = [], isLoading } = useQuery<SeasonHistoryEntry[]>({
    queryKey: ["/api/battle/my/season-history"],
    queryFn: async () => {
      // 使用第一個可用的 fieldId
      const res = await fetch("/api/battle/my/season-history?fieldId=default", {
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const tierColors: Record<string, string> = {
    bronze: "bg-amber-100 text-amber-800",
    silver: "bg-gray-100 text-gray-700",
    gold: "bg-yellow-100 text-yellow-800",
    platinum: "bg-cyan-100 text-cyan-800",
    diamond: "bg-blue-100 text-blue-800",
    master: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 標題列 */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white p-4">
        <div className="flex items-center gap-3">
          <Link href="/battle/my">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              賽季歷史
            </h1>
            <p className="text-sm text-white/80">歷屆賽季排名紀錄</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <p className="text-center py-8 text-muted-foreground">載入中...</p>
        ) : history.length === 0 ? (
          <Card>
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
            <Card key={entry.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold">{entry.seasonName}</h3>
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
                    <span className="text-lg font-bold">#{entry.rank}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 mb-3">
                  <Badge className={`${tierColors[entry.finalTier] ?? ""}`}>
                    {tierLabels[entry.finalTier as keyof typeof tierLabels] ?? entry.finalTier}
                  </Badge>
                  <span className="text-lg font-bold">{entry.finalRating} 分</span>
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-sm">
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">總場</p>
                    <p className="font-semibold">{entry.totalBattles}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">勝</p>
                    <p className="font-semibold text-green-600">{entry.wins}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">負</p>
                    <p className="font-semibold text-red-600">{entry.losses}</p>
                  </div>
                  <div className="bg-muted/50 rounded p-2">
                    <p className="text-xs text-muted-foreground">平</p>
                    <p className="font-semibold">{entry.draws}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
