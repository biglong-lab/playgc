// 水彈對戰 PK 擂台 — 我的對戰歷史（深色軍事風格）
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import BattleLayout from "@/components/battle/BattleLayout";
import type { BattlePlayerResult } from "@shared/schema";
import { History, TrendingUp, TrendingDown, Minus, Star, MapPin, Swords } from "lucide-react";

interface HistoryRecord extends BattlePlayerResult {
  slotDate?: string;
  startTime?: string;
  venueName?: string;
}

export default function BattleHistory() {
  const { user } = useAuth();

  const { data: history = [], isLoading } = useQuery<HistoryRecord[]>({
    queryKey: ["/api/battle/my/history"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/battle/my/history?limit=30");
        return res.json();
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });

  return (
    <BattleLayout title="對戰歷史" subtitle="近期對戰紀錄">
      <div className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : history.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="p-8 text-center text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
              尚無對戰紀錄，快去報名一場吧！
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {history.map((record) => (
              <Card key={record.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{record.team}</Badge>
                      <div className="text-sm">
                        <span className="text-muted-foreground">得分 </span>
                        <span className="font-number font-semibold">{record.score}</span>
                        <span className="text-muted-foreground ml-2">淘汰 </span>
                        <span className="font-number font-semibold">{record.eliminations}</span>
                        <span className="text-muted-foreground ml-2">命中 </span>
                        <span className="font-number font-semibold">{record.hits}</span>
                      </div>
                      {record.isMvp && (
                        <Star className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {record.ratingChange > 0 ? (
                        <span className="flex items-center gap-1 text-green-500 font-number font-semibold text-sm">
                          <TrendingUp className="h-4 w-4" /> +{record.ratingChange}
                        </span>
                      ) : record.ratingChange < 0 ? (
                        <span className="flex items-center gap-1 text-red-500 font-number font-semibold text-sm">
                          <TrendingDown className="h-4 w-4" /> {record.ratingChange}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground text-sm">
                          <Minus className="h-4 w-4" /> 0
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground font-number">{record.ratingAfter}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    {record.venueName && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-3 w-3" />
                        {record.venueName}
                      </span>
                    )}
                    {record.slotDate ?? new Date(record.createdAt).toLocaleDateString("zh-TW")}
                    {record.startTime && ` ${record.startTime.slice(0, 5)}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </BattleLayout>
  );
}
