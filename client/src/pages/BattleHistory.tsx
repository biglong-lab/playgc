// 水彈對戰 PK 擂台 — 我的對戰歷史
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import type { BattlePlayerResult } from "@shared/schema";
import { ArrowLeft, History, TrendingUp, TrendingDown, Minus, Star } from "lucide-react";

export default function BattleHistory() {
  const { user } = useAuth();

  const { data: history = [], isLoading } = useQuery<BattlePlayerResult[]>({
    queryKey: ["/api/battle/my/history"],
    queryFn: async () => {
      const { getIdToken } = await import("@/lib/firebase");
      const token = await getIdToken();
      const res = await fetch("/api/battle/my/history?limit=30", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-3">
        <Link href="/battle">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="h-4 w-4" /> 返回
          </Button>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <History className="h-5 w-5" /> 對戰歷史
        </h1>

        {isLoading ? (
          <p className="text-muted-foreground">載入中...</p>
        ) : history.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              尚無對戰紀錄，快去報名一場吧！
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <Card key={record.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{record.team}</Badge>
                      <div className="text-sm">
                        <span className="text-muted-foreground">得分 </span>
                        <span className="font-semibold">{record.score}</span>
                        <span className="text-muted-foreground ml-2">淘汰 </span>
                        <span className="font-semibold">{record.eliminations}</span>
                        <span className="text-muted-foreground ml-2">命中 </span>
                        <span className="font-semibold">{record.hits}</span>
                      </div>
                      {record.isMvp && (
                        <Star className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.ratingChange > 0 ? (
                        <span className="flex items-center gap-1 text-green-600 font-semibold text-sm">
                          <TrendingUp className="h-4 w-4" /> +{record.ratingChange}
                        </span>
                      ) : record.ratingChange < 0 ? (
                        <span className="flex items-center gap-1 text-red-600 font-semibold text-sm">
                          <TrendingDown className="h-4 w-4" /> {record.ratingChange}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-gray-500 text-sm">
                          <Minus className="h-4 w-4" /> 0
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{record.ratingAfter}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(record.createdAt).toLocaleDateString("zh-TW")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
