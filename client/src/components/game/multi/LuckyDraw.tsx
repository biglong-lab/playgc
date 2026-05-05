// 🎰 LuckyDraw — 多人抽獎機，L3 持久化
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, Star, Crown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Prize {
  id: string;
  name: string;
  emoji: string;
  quantity: number;
}

export interface LuckyDrawConfig {
  title: string;
  subtitle?: string;
  prizes: Prize[];
  drawText?: string;
  suspenseText?: string;
}

export interface Participant {
  userId: string;
  userName: string;
  joinedAt: number;
}

export interface DrawResult {
  prizeId: string;
  prizeName: string;
  prizeEmoji: string;
  winnerId: string;
  winnerName: string;
  drawnAt: number;
}

export interface LuckyDrawState extends Record<string, unknown> {
  phase: "register" | "drawing" | "done";
  participants: Participant[];
  results: DrawResult[];
  hostUserId: string | null;
}

interface LuckyDrawProps {
  config: LuckyDrawConfig;
  state: LuckyDrawState;
  myUserId: string;
  myUserName: string;
  onJoin: () => Promise<void>;
  onStartDraw: () => Promise<void>;
  onDraw: (prizeId: string) => Promise<void>;
  onFinish: () => Promise<void>;
}

function WinnerCard({ result }: { result: DrawResult }) {
  return (
    <div data-testid={`winner-card-${result.prizeId}`} className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200">
      <span className="text-2xl">{result.prizeEmoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm truncate">{result.prizeName}</div>
        <div className="text-xs text-muted-foreground">
          <Crown className="inline w-3 h-3 mr-1 text-yellow-500" />
          {result.winnerName}
        </div>
      </div>
    </div>
  );
}

export default function LuckyDraw({
  config,
  state,
  myUserId,
  myUserName,
  onJoin,
  onStartDraw,
  onDraw,
  onFinish,
}: LuckyDrawProps) {
  const { phase, participants, results, hostUserId } = state;
  const isHost = hostUserId === myUserId;
  const hasJoined = participants.some((p) => p.userId === myUserId);
  const [drawing, setDrawing] = useState(false);

  // 計算剩餘可抽的獎品
  const drawnPrizeCounts: Record<string, number> = {};
  for (const r of results) {
    drawnPrizeCounts[r.prizeId] = (drawnPrizeCounts[r.prizeId] ?? 0) + 1;
  }
  const remainingPrizes = config.prizes.filter(
    (p) => (drawnPrizeCounts[p.id] ?? 0) < p.quantity
  );

  // 最新中獎者（最後一筆 result）
  const lastResult = results[results.length - 1] ?? null;
  const totalPrizeCount = config.prizes.reduce((s, p) => s + p.quantity, 0);
  const drawnCount = results.length;

  const handleDraw = async (prizeId: string) => {
    if (drawing) return;
    setDrawing(true);
    try {
      await onDraw(prizeId);
    } finally {
      setDrawing(false);
    }
  };

  if (phase === "done") {
    return (
      <Card data-testid="lucky-draw-done">
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <Gift className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
            <h2 className="text-xl font-bold">🎉 抽獎結束！</h2>
            <p className="text-muted-foreground text-sm mt-1">共 {drawnCount} 位幸運兒</p>
          </div>
          <div className="space-y-2">
            {results.map((r) => (
              <WinnerCard key={`${r.prizeId}-${r.winnerId}`} result={r} />
            ))}
          </div>
          {isHost && (
            <Button variant="outline" size="sm" className="w-full" onClick={onFinish}>
              結束活動
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="lucky-draw-root">
      <CardContent className="p-6 space-y-5">
        {/* 標題 */}
        <div className="text-center">
          <h2 data-testid="lucky-draw-title" className="text-2xl font-bold">{config.title}</h2>
          {config.subtitle && (
            <p data-testid="lucky-draw-subtitle" className="text-muted-foreground text-sm mt-1">{config.subtitle}</p>
          )}
        </div>

        {/* 參加者計數 */}
        <div data-testid="participant-count" className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Users className="w-4 h-4" />
          {participants.length} 人已加入
        </div>

        {/* register phase */}
        {phase === "register" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">獎品清單</h3>
              {config.prizes.map((prize) => (
                <div key={prize.id} className="flex items-center gap-3 p-2 rounded border">
                  <span className="text-xl">{prize.emoji}</span>
                  <span className="flex-1 text-sm font-medium">{prize.name}</span>
                  <Badge variant="outline">×{prize.quantity}</Badge>
                </div>
              ))}
            </div>

            {!hasJoined ? (
              <Button
                data-testid="join-btn"
                size="lg"
                onClick={onJoin}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                🍀 我要參加抽獎
              </Button>
            ) : (
              <div data-testid="joined-msg" className="text-center text-green-600 font-medium py-2">
                ✅ 已加入抽獎！等待開始…
              </div>
            )}

            {/* 開始抽獎按鈕 (host only, 或第一位點擊者變 host) */}
            <Button
              data-testid="start-draw-btn"
              variant="outline"
              size="sm"
              onClick={onStartDraw}
              className="w-full border-yellow-400 text-yellow-600 hover:bg-yellow-50"
              disabled={participants.length === 0}
            >
              🎰 開始抽獎！
            </Button>
          </div>
        )}

        {/* drawing phase */}
        {phase === "drawing" && (
          <div className="space-y-4">
            {/* 最新中獎者 */}
            {lastResult && (
              <div data-testid="latest-winner" className="text-center p-4 rounded-xl bg-gradient-to-br from-yellow-100 to-amber-100 dark:from-yellow-900/30 dark:to-amber-900/30 border-2 border-yellow-300">
                <div className="text-4xl mb-1">{lastResult.prizeEmoji}</div>
                <div className="font-bold text-lg">{lastResult.prizeName}</div>
                <div className="flex items-center justify-center gap-1 text-yellow-700 font-semibold mt-1">
                  <Crown className="w-4 h-4" />
                  {lastResult.winnerName}
                </div>
              </div>
            )}

            <div className="text-center text-sm text-muted-foreground">
              <span data-testid="draw-progress">已抽 {drawnCount} / {totalPrizeCount}</span>
            </div>

            {/* 剩餘獎品（host 操作） */}
            {isHost && remainingPrizes.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">選擇要抽的獎品</h3>
                {remainingPrizes.map((prize) => {
                  const drawnQty = drawnPrizeCounts[prize.id] ?? 0;
                  const remaining = prize.quantity - drawnQty;
                  return (
                    <Button
                      key={prize.id}
                      data-testid={`draw-btn-${prize.id}`}
                      variant="outline"
                      className="w-full justify-between"
                      disabled={drawing || participants.length === 0}
                      onClick={() => handleDraw(prize.id)}
                    >
                      <span className="flex items-center gap-2">
                        <span>{prize.emoji}</span>
                        <span>{prize.name}</span>
                      </span>
                      <Badge variant="secondary">剩 {remaining}</Badge>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* 非 host 看所有已抽結果 */}
            {results.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase">中獎名單</h3>
                {results.map((r) => (
                  <WinnerCard key={`${r.prizeId}-${r.winnerId}`} result={r} />
                ))}
              </div>
            )}

            {/* 完成按鈕 */}
            {isHost && remainingPrizes.length === 0 && (
              <Button
                data-testid="finish-btn"
                className="w-full bg-green-600 hover:bg-green-700 text-white"
                onClick={onFinish}
              >
                🎊 抽獎完成！
              </Button>
            )}

            {/* 我中獎了！ */}
            {results.some((r) => r.winnerId === myUserId) && (
              <div
                data-testid="i-won-msg"
                className={cn(
                  "text-center p-3 rounded-lg font-bold",
                  "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200"
                )}
              >
                <Star className="inline w-5 h-5 mr-1" />
                🎉 恭喜你中獎了！
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
