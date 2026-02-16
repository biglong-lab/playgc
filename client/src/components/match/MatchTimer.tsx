// 對戰計時器元件 — 倒數計時 + 經過時間
import { useState, useEffect, useRef } from "react";
import { Clock, Timer } from "lucide-react";

interface MatchTimerProps {
  readonly mode: "countdown" | "elapsed";
  readonly seconds: number;
  readonly onCountdownEnd?: () => void;
}

function formatTime(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function MatchTimer({ mode, seconds, onCountdownEnd }: MatchTimerProps) {
  const [timeLeft, setTimeLeft] = useState(seconds);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (mode === "countdown") {
      setTimeLeft(seconds);
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            onCountdownEnd?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setElapsed(0);
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [mode, seconds, onCountdownEnd]);

  const isCountdown = mode === "countdown";
  const displayTime = isCountdown ? timeLeft : elapsed;
  const isUrgent = isCountdown && timeLeft <= 10;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-lg ${
      isUrgent ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted"
    }`}>
      {isCountdown ? (
        <Timer className="h-5 w-5" />
      ) : (
        <Clock className="h-5 w-5" />
      )}
      <span className="font-bold">{formatTime(displayTime)}</span>
    </div>
  );
}
