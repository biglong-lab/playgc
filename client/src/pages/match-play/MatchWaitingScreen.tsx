// 🏁 遊戲頁的賽事等待畫面（2026-09-23 P1）
//   - 接力還沒輪到我：顯示「第 N 棒進行中」，輪到我時自動開始（閘門切回遊戲）
//   - 我完成了 / 我那棒跑完了：看即時排名 / 接力進度，等全員完成或時間到（自動跳結算）
import { useQuery } from "@tanstack/react-query";
import { Hourglass, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import LiveRanking from "@/components/match/LiveRanking";
import RelayProgress from "@/components/match/RelayProgress";
import HostFinishButton from "@/components/match/HostFinishButton";
import { apiRequest } from "@/lib/queryClient";
import type { MatchDetail, MyMatchState } from "@/lib/match-types";
import MatchHud from "./MatchHud";

interface MatchWaitingScreenProps {
  me: MyMatchState;
  userId?: string;
  showScore: boolean;
}

function headline(me: MyMatchState): { icon: typeof Hourglass; title: string; hint: string } {
  const r = me.relay;
  if (me.matchMode === "relay" && r?.status === "pending") {
    return {
      icon: Hourglass,
      title: `你是第 ${r.segment} 棒（第 ${r.fromPage}–${r.toPage} 頁）`,
      hint: `目前第 ${r.activeSegment ?? "?"} 棒進行中，輪到你時會自動開始`,
    };
  }
  if (me.matchMode === "relay") {
    return { icon: CheckCircle2, title: "你這一棒完成了！", hint: "等隊友跑完，最後一棒完成就會自動結算" };
  }
  return { icon: CheckCircle2, title: "你完成了！", hint: "等其他人完成或時間到，就會自動公布結果" };
}

export default function MatchWaitingScreen({ me, userId, showScore }: MatchWaitingScreenProps) {
  const { data: detail } = useQuery<MatchDetail>({
    queryKey: ["/api/matches", me.matchId],
    refetchInterval: 3000,
  });
  const info = headline(me);
  const Icon = info.icon;
  const isRelay = me.matchMode === "relay";
  const isHost = !!detail && detail.creatorId === userId;

  return (
    <div className="min-h-screen-dynamic bg-background px-4 py-10" data-testid="match-waiting-screen">
      <MatchHud me={me} />
      <div className="max-w-md mx-auto space-y-4">
        <Card>
          <CardContent className="pt-6 text-center space-y-2">
            <Icon className="h-10 w-10 text-primary mx-auto" />
            <p className="text-lg font-bold">{info.title}</p>
            <p className="text-sm text-muted-foreground">{info.hint}</p>
          </CardContent>
        </Card>
        {detail && isRelay && detail.relayLegs.length > 0 && (
          <RelayProgress participants={detail.ranking} segmentCount={detail.relayLegs.length} />
        )}
        {detail && (
          <LiveRanking ranking={detail.ranking} currentUserId={userId} showRelay={isRelay} showScore={showScore} />
        )}
        {isHost && (
          <HostFinishButton
            onFinish={() => void apiRequest("POST", `/api/matches/${me.matchId}/finish`).catch(() => undefined)}
          />
        )}
      </div>
    </div>
  );
}
