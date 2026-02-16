// 即時排名看板元件 — 對戰中的即時排名顯示
import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, User } from "lucide-react";

interface RankingEntry {
  readonly userId: string;
  readonly userName?: string;
  readonly score: number;
  readonly rank: number;
  readonly relaySegment?: number | null;
  readonly relayStatus?: string | null;
}

interface LiveRankingProps {
  readonly ranking: readonly RankingEntry[];
  readonly currentUserId?: string;
  readonly showRelay?: boolean;
}

function getRankIcon(rank: number) {
  switch (rank) {
    case 1: return <Trophy className="h-5 w-5 text-yellow-500" />;
    case 2: return <Medal className="h-5 w-5 text-gray-400" />;
    case 3: return <Award className="h-5 w-5 text-amber-600" />;
    default: return <span className="text-sm text-muted-foreground w-5 text-center">{rank}</span>;
  }
}

function getRelayStatusBadge(status: string | null | undefined) {
  switch (status) {
    case "active": return <Badge variant="default">進行中</Badge>;
    case "completed": return <Badge variant="secondary">已完成</Badge>;
    case "pending": return <Badge variant="outline">待命</Badge>;
    default: return null;
  }
}

export default function LiveRanking({ ranking, currentUserId, showRelay }: LiveRankingProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" />
          即時排名
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ranking.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            尚無參與者
          </p>
        ) : (
          <div className="space-y-2">
            {ranking.map((entry) => {
              const isCurrentUser = entry.userId === currentUserId;
              return (
                <div
                  key={entry.userId}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                    isCurrentUser ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                  }`}
                >
                  <div className="flex-shrink-0">{getRankIcon(entry.rank)}</div>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className={`text-sm truncate ${isCurrentUser ? "font-bold" : ""}`}>
                      {entry.userName ?? entry.userId.slice(0, 8)}
                      {isCurrentUser && " (你)"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {showRelay && getRelayStatusBadge(entry.relayStatus)}
                    <span className="font-mono text-sm font-bold">
                      {entry.score}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
