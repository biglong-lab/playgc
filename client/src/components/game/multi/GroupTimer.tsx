// ⏱️ GroupTimer — 多人共享倒數計時器（純 UI）
// 第一位玩家按下「開始」後，所有人的手機同步倒數
// 適用：限時任務、答題限時、場次切換倒數

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Timer, Play } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GroupTimerConfig {
  title?: string;
  durationSeconds: number;
  message?: string;
  completedText?: string;
}

export interface GroupTimerState {
  startedAt: number | null;
  startedBy: string | null;
}

interface GroupTimerProps {
  config: GroupTimerConfig;
  state: GroupTimerState;
  myUserId: string;
  onStart: () => Promise<void>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(Math.max(seconds, 0) / 60);
  const s = Math.max(seconds, 0) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GroupTimer({ config, state, myUserId, onStart }: GroupTimerProps) {
  const [elapsed, setElapsed] = useState(0);
  const [isStarting, setIsStarting] = useState(false);

  const duration = config.durationSeconds;
  const isRunning = state.startedAt !== null;
  const remaining = isRunning ? Math.max(duration - elapsed, 0) : duration;
  const isCompleted = isRunning && remaining === 0;
  const pct = isRunning ? Math.min((elapsed / duration) * 100, 100) : 0;

  useEffect(() => {
    if (!state.startedAt) {
      setElapsed(0);
      return;
    }
    const tick = () => {
      setElapsed(Math.floor((Date.now() - state.startedAt!) / 1000));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [state.startedAt]);

  const handleStart = async () => {
    if (isStarting || isRunning) return;
    setIsStarting(true);
    try {
      await onStart();
    } finally {
      setIsStarting(false);
    }
  };

  const timerColor = isCompleted
    ? "text-green-600"
    : remaining <= 10
    ? "text-red-500 animate-pulse"
    : remaining <= 30
    ? "text-orange-500"
    : "text-foreground";

  return (
    <div className="space-y-4" data-testid="group-timer-root">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2" data-testid="group-timer-title">
            <Timer className="w-5 h-5 text-primary" />
            {config.title ?? "⏱️ 限時倒數"}
          </CardTitle>
          {config.message && !isCompleted && (
            <p className="text-sm text-muted-foreground">{config.message}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {isCompleted ? (
            <div className="text-center py-6 space-y-3" data-testid="group-timer-completed">
              <p className="text-4xl">🎉</p>
              <p className="text-lg font-bold text-green-600">時間到！</p>
              {config.completedText && (
                <p className="text-sm text-muted-foreground">{config.completedText}</p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* 時間顯示 */}
              <div className="text-center py-4">
                <span
                  className={cn("text-6xl font-mono font-bold tabular-nums", timerColor)}
                  data-testid="group-timer-display"
                >
                  {formatTime(remaining)}
                </span>
              </div>

              {/* 進度條 */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden" data-testid="group-timer-bar">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    pct >= 100 ? "bg-red-500" : remaining <= 10 ? "bg-red-400" : "bg-primary",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>

              {/* 開始按鈕 */}
              {!isRunning && (
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => void handleStart()}
                  disabled={isStarting}
                  data-testid="group-timer-start-btn"
                >
                  <Play className="w-5 h-5 mr-2" />
                  開始倒數
                </Button>
              )}

              {isRunning && state.startedBy !== myUserId && (
                <p className="text-xs text-muted-foreground text-center" data-testid="group-timer-info">
                  倒數進行中…
                </p>
              )}

              {isRunning && state.startedBy === myUserId && (
                <p className="text-xs text-muted-foreground text-center" data-testid="group-timer-info">
                  你已啟動倒數，全員同步進行中
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
