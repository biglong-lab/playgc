// 🏁 遊戲中的賽事小看板（剩餘時間 / 我的名次 / 接力棒次），2026-09-23 P1
import { useEffect, useState } from "react";
import { Timer, Trophy, Flag } from "lucide-react";
import { remainingSeconds, type MyMatchState } from "@/lib/match-types";
import { formatTime } from "@/components/match/MatchTimer";

function useNowEverySecond(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

export default function MatchHud({ me }: { me: MyMatchState }) {
  const hasLimit = !!me.timeLimitSeconds && !!me.startedAt;
  const now = useNowEverySecond(hasLimit);
  const left = remainingSeconds(me.startedAt, me.timeLimitSeconds, now);
  const isRelay = me.matchMode === "relay";
  const urgent = left !== null && left <= 60;

  return (
    <div
      className="fixed top-16 right-2 z-40 flex items-center gap-2 rounded-full border border-border bg-card/95 px-3 py-1 text-xs shadow backdrop-blur"
      data-testid="match-hud"
    >
      {left !== null && (
        <span className={`flex items-center gap-1 font-mono ${urgent ? "text-destructive font-bold" : ""}`}>
          <Timer className="h-3.5 w-3.5" />
          {formatTime(left)}
        </span>
      )}
      {isRelay ? (
        <span className="flex items-center gap-1">
          <Flag className="h-3.5 w-3.5" />
          第 {me.relay?.segment ?? "?"}/{me.relay?.totalSegments ?? "?"} 棒
        </span>
      ) : (
        me.myRank !== null && (
          <span className="flex items-center gap-1" data-testid="match-hud-rank">
            <Trophy className="h-3.5 w-3.5 text-yellow-500" />
            第 {me.myRank}/{me.participantCount} 名
          </span>
        )
      )}
    </div>
  );
}
