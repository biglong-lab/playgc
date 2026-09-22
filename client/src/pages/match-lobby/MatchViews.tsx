// 對戰大廳視圖元件（2026-09-23 P1：瀏覽 / 等待拆到獨立檔，這裡放倒數 / 進行中 / 結算）
import { Loader2, Swords, Trophy, Ban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import LiveRanking from "@/components/match/LiveRanking";
import MatchTimer from "@/components/match/MatchTimer";
import RelayProgress from "@/components/match/RelayProgress";
import HostFinishButton from "@/components/match/HostFinishButton";
import SaveRecordCard from "@/components/game/SaveRecordCard";
import { countdownNumber, celebrationPop } from "@/lib/animation-variants";
import { remainingSeconds, type MatchDetail } from "@/lib/match-types";

export { BrowseMatchesView } from "./BrowseView";
export { WaitingView } from "./WaitingView";

export function LoadingView() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function CountdownView({ seconds }: { readonly seconds: number }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={seconds}
            variants={countdownNumber}
            initial="initial"
            animate="animate"
            exit="exit"
            className="text-8xl font-mono font-bold text-primary"
          >
            {seconds}
          </motion.p>
        </AnimatePresence>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl text-muted-foreground mt-4">
          準備開始...
        </motion.p>
      </div>
    </div>
  );
}

interface PlayingViewProps {
  readonly match: MatchDetail;
  readonly userId?: string;
  readonly isCreator: boolean;
  readonly showScore: boolean;
  readonly onFinish: () => void;
}

/** 進行中（旁觀者 / 房主回到大廳時看到；參賽者會被自動導回遊戲） */
export function PlayingView({ match, userId, isCreator, showScore, onFinish }: PlayingViewProps) {
  const isRelay = match.matchMode === "relay";
  const left = remainingSeconds(match.startedAt, match.timeLimitSeconds);
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Swords className="h-5 w-5" />
          賽事進行中
        </h1>
        {left !== null ? <MatchTimer mode="countdown" seconds={left} /> : <MatchTimer mode="elapsed" seconds={0} />}
      </div>
      {isRelay && match.relayLegs.length > 0 && (
        <RelayProgress participants={match.ranking} segmentCount={match.relayLegs.length} />
      )}
      <LiveRanking ranking={match.ranking} currentUserId={userId} showRelay={isRelay} showScore={showScore} />
      {isCreator && <HostFinishButton onFinish={onFinish} />}
    </div>
  );
}

interface FinishedViewProps {
  readonly match: MatchDetail;
  readonly userId?: string;
  readonly showScore: boolean;
  readonly onPlayAnother: () => void;
  readonly onGoBack: () => void;
}

export function FinishedView({ match, userId, showScore, onPlayAnother, onGoBack }: FinishedViewProps) {
  const isRelay = match.matchMode === "relay";
  const mine = match.ranking.find((r) => r.userId === userId);
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <motion.div variants={celebrationPop} initial="initial" animate="animate">
          <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
        </motion.div>
        <h1 className="text-2xl font-bold">賽事結束！</h1>
        {isRelay && showScore && match.teamTotal !== null && (
          <p className="text-muted-foreground mt-1" data-testid="text-relay-total">全隊總分 {match.teamTotal}</p>
        )}
        {!isRelay && mine && (
          <p className="text-muted-foreground mt-1" data-testid="text-my-rank">你是第 {mine.rank} 名</p>
        )}
      </div>
      {/* 🎟️ 訪客：登入後這場紀錄才歸到帳號（正式帳號不顯示） */}
      <SaveRecordCard scoringEnabled={showScore} />
      <LiveRanking
        ranking={match.ranking}
        currentUserId={userId}
        showRelay={isRelay}
        showScore={showScore}
        title={isRelay ? "各棒成績" : "最終排名"}
      />
      <div className="grid grid-cols-2 gap-2 mt-6">
        <Button variant="outline" onClick={onGoBack}>返回大廳</Button>
        <Button onClick={onPlayAnother} data-testid="button-play-another-match">再來一場</Button>
      </div>
    </div>
  );
}

export function CancelledView({ onBack }: { readonly onBack: () => void }) {
  return (
    <div className="container max-w-md mx-auto px-4 py-16">
      <Card>
        <CardContent className="pt-6 text-center space-y-4">
          <Ban className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="font-medium">房主已取消這場賽事</p>
          <Button className="w-full" onClick={onBack}>回到賽事列表</Button>
        </CardContent>
      </Card>
    </div>
  );
}
