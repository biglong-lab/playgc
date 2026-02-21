import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Smartphone, RotateCw, ArrowUp, Check, AlertCircle, Clock, Play, Pause } from "lucide-react";
import type { MotionChallengeConfig } from "@shared/schema";

interface MotionChallengePageProps {
  config: MotionChallengeConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

const CHALLENGE_ICONS = {
  shake: Smartphone,
  tilt: RotateCw,
  jump: ArrowUp,
  rotate: RotateCw,
};

const CHALLENGE_LABELS = {
  shake: "搖晃手機",
  tilt: "傾斜手機",
  jump: "跳躍",
  rotate: "旋轉手機",
};

export default function MotionChallengePage({ config, onComplete }: MotionChallengePageProps) {
  const { toast } = useToast();
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.timeLimit || 30);
  const [error, setError] = useState<string | null>(null);
  
  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const shakeCountRef = useRef(0);
  const tiltAngleRef = useRef(0);

  const challengeType = config.challengeType || "shake";
  const targetValue = config.targetValue || 20;
  const ChallengeIcon = CHALLENGE_ICONS[challengeType];

  const handleComplete = useCallback(() => {
    setIsCompleted(true);
    toast({
      title: config.successMessage || "挑戰成功!",
      description: "做得好!",
    });
    setTimeout(() => {
      onComplete({ points: config.rewardPoints || 15 }, config.nextPageId);
    }, 2000);
  }, [config, onComplete, toast]);

  const handleFail = useCallback(() => {
    setIsFailed(true);
    toast({
      title: config.failureMessage || "挑戰失敗",
      description: "時間到了!",
      variant: "destructive",
    });
    setTimeout(() => {
      onComplete({ points: 0 }, config.nextPageId);
    }, 2000);
  }, [config, onComplete, toast]);

  useEffect(() => {
    if (!isStarted || isCompleted || isFailed) return;

    if (config.timeLimit) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleFail();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isStarted, isCompleted, isFailed, config.timeLimit, handleFail]);

  useEffect(() => {
    if (!isStarted || isCompleted || isFailed) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const x = accel.x ?? 0;
      const y = accel.y ?? 0;
      const z = accel.z ?? 0;
      const last = lastAccelRef.current;

      if (challengeType === "shake") {
        const deltaX = Math.abs(x - last.x);
        const deltaY = Math.abs(y - last.y);
        const deltaZ = Math.abs(z - last.z);
        const totalDelta = deltaX + deltaY + deltaZ;

        if (totalDelta > 15) {
          shakeCountRef.current += 1;
          const newProgress = Math.min(100, (shakeCountRef.current / targetValue) * 100);
          setProgress(newProgress);

          if (shakeCountRef.current >= targetValue) {
            handleComplete();
          }
        }
      }

      lastAccelRef.current = { x, y, z };
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (challengeType === "tilt" || challengeType === "rotate") {
        const beta = event.beta ?? 0;
        const gamma = event.gamma ?? 0;
        const angle = Math.max(Math.abs(beta), Math.abs(gamma));
        
        if (angle > tiltAngleRef.current) {
          tiltAngleRef.current = angle;
          const newProgress = Math.min(100, (angle / targetValue) * 100);
          setProgress(newProgress);

          if (angle >= targetValue) {
            handleComplete();
          }
        }
      }
    };

    if (typeof DeviceMotionEvent !== "undefined") {
      if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
        (DeviceMotionEvent as any).requestPermission()
          .then((response: string) => {
            if (response === "granted") {
              window.addEventListener("devicemotion", handleMotion);
              window.addEventListener("deviceorientation", handleOrientation);
            } else {
              setError("需要動作感測器權限");
            }
          })
          .catch(() => {
            setError("無法取得動作感測器權限");
          });
      } else {
        window.addEventListener("devicemotion", handleMotion);
        window.addEventListener("deviceorientation", handleOrientation);
      }
    } else {
      setError("您的裝置不支援動作感測器");
    }

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [isStarted, isCompleted, isFailed, challengeType, targetValue, handleComplete]);

  const startChallenge = async () => {
    shakeCountRef.current = 0;
    tiltAngleRef.current = 0;
    setProgress(0);
    setTimeLeft(config.timeLimit || 30);
    setIsStarted(true);
    setError(null);
  };

  const simulateProgress = () => {
    setProgress((prev) => {
      const newProgress = prev + 10;
      if (newProgress >= 100) {
        handleComplete();
        return 100;
      }
      return newProgress;
    });
  };

  if (isCompleted) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-success/10">
        <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mb-4 animate-scaleIn">
          <Check className="w-12 h-12 text-success" />
        </div>
        <h2 className="text-3xl font-display font-bold text-success mb-2">挑戰成功!</h2>
        <p className="text-muted-foreground">{config.successMessage || "做得好!"}</p>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-destructive/10">
        <div className="w-24 h-24 rounded-full bg-destructive/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
        </div>
        <h2 className="text-3xl font-display font-bold text-destructive mb-2">時間到!</h2>
        <p className="text-muted-foreground">{config.failureMessage || "挑戰失敗"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
              isStarted ? "bg-primary/20 animate-pulse" : "bg-muted"
            }`}>
              <ChallengeIcon className={`w-10 h-10 ${isStarted ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">
              {config.title || CHALLENGE_LABELS[challengeType]}
            </h2>
            <p className="text-muted-foreground">
              {config.instruction || `請${CHALLENGE_LABELS[challengeType]}來完成挑戰`}
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mb-4 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-destructive">{error}</span>
            </div>
          )}

          {isStarted && config.timeLimit && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <Clock className={`w-5 h-5 ${timeLeft <= 10 ? "text-destructive" : "text-muted-foreground"}`} />
              <span className={`font-mono text-2xl font-bold ${timeLeft <= 10 ? "text-destructive animate-pulse" : ""}`}>
                {timeLeft}s
              </span>
            </div>
          )}

          {(isStarted || config.showProgress) && (
            <div className="mb-6">
              <div className="flex justify-between text-sm text-muted-foreground mb-2">
                <span>進度</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}

          <div className="space-y-3">
            {!isStarted ? (
              <Button
                onClick={startChallenge}
                className="w-full gap-2"
                size="lg"
                data-testid="button-start-challenge"
              >
                <Play className="w-5 h-5" />
                開始挑戰
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsStarted(false)}
                className="w-full gap-2"
                data-testid="button-pause-challenge"
              >
                <Pause className="w-5 h-5" />
                暫停
              </Button>
            )}

          </div>
        </CardContent>
      </Card>
    </div>
  );
}
