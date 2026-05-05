// 🎯 CountdownReveal — 倒數揭曉元件（純 UI）
// 所有人共同等待倒數結束，揭曉重要消息（獎項、結果、驚喜）
// 主持人控制開始，玩家端看倒數 + 懸念動畫，時間到顯示揭曉內容
// 適用：年會頒獎、競賽結果公布、生日驚喜

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Gift } from "lucide-react";

export interface CountdownRevealConfig {
  title?: string;
  revealText: string;
  revealEmoji?: string;
  durationSeconds?: number;
  suspenseMessage?: string;
}

export interface CountdownRevealState extends Record<string, unknown> {
  startedAt: number | null;
  startedBy: string | null;
}

interface CountdownRevealProps {
  config: CountdownRevealConfig;
  state: CountdownRevealState;
  myUserId: string;
  isHost?: boolean;
  onStart: () => Promise<void>;
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return s.toString();
}

export default function CountdownReveal({ config, state, myUserId: _myUserId, isHost, onStart }: CountdownRevealProps) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  const duration = config.durationSeconds ?? 5;
  const hasStarted = state.startedAt !== null;
  const isRevealed = remaining !== null && remaining <= 0;

  useEffect(() => {
    if (!state.startedAt) {
      setRemaining(null);
      return;
    }

    const tick = () => {
      const elapsed = (Date.now() - state.startedAt!) / 1000;
      const rem = duration - elapsed;
      setRemaining(rem);
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [state.startedAt, duration]);

  const handleStart = async () => {
    if (isStarting || hasStarted) return;
    setIsStarting(true);
    try {
      await onStart();
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="countdown-reveal-root">
      <Card className="overflow-hidden">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide" data-testid="countdown-title">
            {config.title ?? "🎯 倒數揭曉"}
          </p>

          {!hasStarted && (
            <div className="space-y-4">
              <p className="text-6xl">🎁</p>
              <p className="text-muted-foreground text-sm">
                {config.suspenseMessage ?? "準備好了嗎？倒數即將開始…"}
              </p>
              {isHost && (
                <Button
                  size="lg"
                  onClick={() => void handleStart()}
                  disabled={isStarting}
                  data-testid="countdown-start-btn"
                >
                  <Timer className="w-4 h-4 mr-2" />
                  開始倒數
                </Button>
              )}
            </div>
          )}

          {hasStarted && !isRevealed && remaining !== null && (
            <div className="space-y-2" data-testid="countdown-active">
              <div
                className="text-8xl font-black tabular-nums text-primary animate-bounce"
                data-testid="countdown-number"
              >
                {formatTime(remaining)}
              </div>
              <p className="text-muted-foreground text-sm animate-pulse">倒數中…</p>
            </div>
          )}

          {isRevealed && (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-700" data-testid="countdown-revealed">
              <p className="text-7xl" data-testid="reveal-emoji">
                {config.revealEmoji ?? "🎉"}
              </p>
              <p className="text-2xl font-bold text-foreground" data-testid="reveal-text">
                {config.revealText}
              </p>
              <div className="flex justify-center">
                <Gift className="w-5 h-5 text-amber-500 animate-pulse" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
