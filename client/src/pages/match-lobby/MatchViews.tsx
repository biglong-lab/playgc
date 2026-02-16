// 對戰大廳視圖元件
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Swords, Users, Play, ArrowLeft, Trophy, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import LiveRanking from "@/components/match/LiveRanking";
import MatchTimer from "@/components/match/MatchTimer";
import RelayProgress from "@/components/match/RelayProgress";
import { countdownNumber, celebrationPop } from "@/lib/animation-variants";
import type { Game } from "@shared/schema";

// ============================================================================
// LoadingView
// ============================================================================
export function LoadingView() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// ============================================================================
// BrowseMatchesView — 瀏覽/建立對戰
// ============================================================================
interface BrowseMatchesViewProps {
  readonly game: Game | undefined;
  readonly matches: readonly Record<string, unknown>[];
  readonly onCreateMatch: (body: Record<string, unknown>) => void;
  readonly onJoinMatch: (matchId: string) => void;
  readonly onGoBack: () => void;
  readonly isCreating: boolean;
  readonly isJoining: boolean;
}

export function BrowseMatchesView({
  game,
  matches,
  onCreateMatch,
  onJoinMatch,
  onGoBack,
  isCreating,
  isJoining,
}: BrowseMatchesViewProps) {
  const waitingMatches = matches.filter(
    (m) => (m as Record<string, unknown>).status === "waiting",
  );

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={onGoBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{game?.title ?? "對戰大廳"}</h1>
          <p className="text-sm text-muted-foreground">
            {game?.gameMode === "relay" ? "接力模式" : "競爭模式"}
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <Button
            className="w-full"
            onClick={() => onCreateMatch({ matchMode: game?.gameMode ?? "competitive" })}
            disabled={isCreating}
          >
            {isCreating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Swords className="h-4 w-4 mr-2" />}
            建立新對戰
          </Button>
        </CardContent>
      </Card>

      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <Users className="h-5 w-5" />
        等待中的對戰 ({waitingMatches.length})
      </h2>

      {waitingMatches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            目前沒有等待中的對戰，建立一個吧！
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {waitingMatches.map((match) => {
            const m = match as Record<string, unknown>;
            return (
              <Card key={m.id as string} className="hover:border-primary/50 transition-colors">
                <CardContent className="flex items-center justify-between py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{m.accessCode as string}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {((m.participants as unknown[]) ?? []).length}/{m.maxTeams as number} 人
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onJoinMatch(m.id as string)}
                    disabled={isJoining}
                  >
                    {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : "加入"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// WaitingView — 等待其他玩家加入
// ============================================================================
interface WaitingViewProps {
  readonly match: Record<string, unknown> | undefined;
  readonly isCreator: boolean;
  readonly onStart: () => void;
  readonly isStarting: boolean;
  readonly ranking: readonly { userId: string; score: number; rank: number }[];
  readonly userId?: string;
}

export function WaitingView({ match, isCreator, onStart, isStarting, ranking, userId }: WaitingViewProps) {
  const participants = (match?.participants as unknown[]) ?? [];

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            等待中
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <p className="text-3xl font-mono font-bold text-primary">
              {(match?.accessCode as string) ?? "------"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">分享此代碼給其他玩家</p>
          </div>

          <div className="flex items-center justify-center gap-2">
            <Users className="h-4 w-4" />
            <span>{participants.length} 人已加入</span>
          </div>

          {isCreator && (
            <Button
              className="w-full"
              size="lg"
              onClick={onStart}
              disabled={isStarting || participants.length < 2}
            >
              {isStarting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              開始對戰 ({participants.length} 人)
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// CountdownView — 倒數計時
// ============================================================================
interface CountdownViewProps {
  readonly seconds: number;
}

export function CountdownView({ seconds }: CountdownViewProps) {
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
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl text-muted-foreground mt-4"
        >
          準備開始...
        </motion.p>
      </div>
    </div>
  );
}

// ============================================================================
// PlayingView — 對戰進行中
// ============================================================================
interface PlayingViewProps {
  readonly match: Record<string, unknown> | undefined;
  readonly ranking: readonly { userId: string; score: number; rank: number }[];
  readonly userId?: string;
  readonly isRelay?: boolean;
}

export function PlayingView({ match, ranking, userId, isRelay }: PlayingViewProps) {
  const settings = match?.settings as Record<string, unknown> | undefined;
  const timeLimit = (settings?.timeLimit as number) ?? 0;
  const relayConfig = match?.relayConfig as Record<string, unknown> | undefined;
  const segmentCount = (relayConfig?.segmentCount as number) ?? 0;

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Swords className="h-5 w-5" />
          對戰進行中
        </h1>
        {timeLimit > 0 && (
          <MatchTimer mode="countdown" seconds={timeLimit} />
        )}
        {!timeLimit && (
          <MatchTimer mode="elapsed" seconds={0} />
        )}
      </div>

      {isRelay && segmentCount > 0 && (
        <RelayProgress participants={ranking} segmentCount={segmentCount} />
      )}

      <LiveRanking
        ranking={ranking as { userId: string; score: number; rank: number }[]}
        currentUserId={userId}
        showRelay={isRelay}
      />
    </div>
  );
}

// ============================================================================
// FinishedView — 對戰結束
// ============================================================================
interface FinishedViewProps {
  readonly ranking: readonly { userId: string; score: number; rank: number }[];
  readonly userId?: string;
  readonly onGoBack: () => void;
}

export function FinishedView({ ranking, userId, onGoBack }: FinishedViewProps) {
  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <motion.div
          variants={celebrationPop}
          initial="initial"
          animate="animate"
        >
          <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-3" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="text-2xl font-bold"
        >
          對戰結束！
        </motion.h1>
      </div>

      <LiveRanking
        ranking={ranking as { userId: string; score: number; rank: number }[]}
        currentUserId={userId}
      />

      <Button className="w-full mt-6" onClick={onGoBack}>
        返回遊戲大廳
      </Button>
    </div>
  );
}
