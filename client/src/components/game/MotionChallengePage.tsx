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
  const [hitCount, setHitCount] = useState(0);
  const [hitPulseKey, setHitPulseKey] = useState(0);

  const lastAccelRef = useRef({ x: 0, y: 0, z: 0 });
  const shakeCountRef = useRef(0);
  const tiltAngleRef = useRef(0);
  const lastHitTimeRef = useRef(0);

  // 命中回饋（每次成功震動/跳動/轉動時觸發視覺脈動）
  const triggerHitFeedback = useCallback(() => {
    const now = Date.now();
    // 節流：避免一秒內多次動畫卡頓（最短 100ms 一次）
    if (now - lastHitTimeRef.current < 100) return;
    lastHitTimeRef.current = now;
    setHitCount((c) => c + 1);
    setHitPulseKey((k) => k + 1);
    // 觸覺回饋（支援的裝置）
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try { navigator.vibrate(30); } catch { /* noop */ }
    }
  }, []);

  const challengeType = config.challengeType || "shake";
  const targetValue = config.targetValue || 20;
  const ChallengeIcon = CHALLENGE_ICONS[challengeType];

  // 防重複觸發：目標達成後，玩家若繼續搖晃，handleMotion 會在 React 批次前多次呼叫 handleComplete
  // 同時 handleFail 也可能與 handleComplete 競爭（時間到剛好目標達成）
  const isResolvedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (isResolvedRef.current) return;
    isResolvedRef.current = true;
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
    if (isResolvedRef.current) return;
    isResolvedRef.current = true;
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

    // 初次事件標記：避免第一次 motion 的 delta 含重力造成誤計數
    let isFirstMotion = true;
    // jump 偵測用：z 軸過零次數
    let lastZSign: number | null = null;
    let jumpCount = 0;

    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel) return;

      const x = accel.x ?? 0;
      const y = accel.y ?? 0;
      const z = accel.z ?? 0;
      const last = lastAccelRef.current;

      // 第一次事件僅記錄 lastAccel，不計算 delta（避免重力干擾）
      if (isFirstMotion) {
        lastAccelRef.current = { x, y, z };
        isFirstMotion = false;
        return;
      }

      if (challengeType === "shake") {
        const deltaX = Math.abs(x - last.x);
        const deltaY = Math.abs(y - last.y);
        const deltaZ = Math.abs(z - last.z);
        const totalDelta = deltaX + deltaY + deltaZ;

        if (totalDelta > 15) {
          shakeCountRef.current += 1;
          const newProgress = Math.min(100, (shakeCountRef.current / targetValue) * 100);
          setProgress(newProgress);
          triggerHitFeedback();

          if (shakeCountRef.current >= targetValue) {
            handleComplete();
          }
        }
      } else if (challengeType === "jump") {
        // jump：純加速度 z 軸（去除重力）過零偵測
        const pureAccel = event.acceleration;
        const az = pureAccel?.z ?? (z - 9.8);
        // 明顯跳動才計入（閾值 3 m/s²）
        if (Math.abs(az) > 3) {
          const sign = az > 0 ? 1 : -1;
          if (lastZSign !== null && lastZSign !== sign) {
            jumpCount += 1;
            shakeCountRef.current = jumpCount; // 共用 ref
            const newProgress = Math.min(100, (jumpCount / targetValue) * 100);
            setProgress(newProgress);
            triggerHitFeedback();
            if (jumpCount >= targetValue) {
              handleComplete();
            }
          }
          lastZSign = sign;
        }
      }

      lastAccelRef.current = { x, y, z };
    };

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (challengeType === "tilt") {
        const beta = event.beta ?? 0;
        const gamma = event.gamma ?? 0;
        const angle = Math.max(Math.abs(beta), Math.abs(gamma));

        if (angle > tiltAngleRef.current) {
          tiltAngleRef.current = angle;
          const newProgress = Math.min(100, (angle / targetValue) * 100);
          setProgress(newProgress);
          triggerHitFeedback();

          if (angle >= targetValue) {
            handleComplete();
          }
        }
      } else if (challengeType === "rotate") {
        // rotate：用 alpha（z 軸羅盤方向），累積角度變化
        const alpha = event.alpha ?? 0;
        if (tiltAngleRef.current === 0) {
          // 初始化基準
          tiltAngleRef.current = alpha;
          return;
        }
        // 計算角度差（處理 0/360 邊界）
        let delta = Math.abs(alpha - tiltAngleRef.current);
        if (delta > 180) delta = 360 - delta;
        if (delta > 5) {
          // 視為一次明顯轉動，累積
          shakeCountRef.current += delta;
          tiltAngleRef.current = alpha;
          const newProgress = Math.min(100, (shakeCountRef.current / targetValue) * 100);
          setProgress(newProgress);
          triggerHitFeedback();
          if (shakeCountRef.current >= targetValue) {
            handleComplete();
          }
        }
      }
    };

    window.addEventListener("devicemotion", handleMotion);
    window.addEventListener("deviceorientation", handleOrientation);

    return () => {
      window.removeEventListener("devicemotion", handleMotion);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [isStarted, isCompleted, isFailed, challengeType, targetValue, handleComplete, triggerHitFeedback]);

  // iOS 13+ 權限請求必須在 user gesture 同步堆疊中觸發
  const startChallenge = async () => {
    try {
      // Motion 權限（iOS 13+）
      const MotionEventAny = DeviceMotionEvent as any;
      if (typeof MotionEventAny?.requestPermission === "function") {
        const motionRes = await MotionEventAny.requestPermission();
        if (motionRes !== "granted") {
          setError("需要動作感測器權限，請重新嘗試並允許");
          return;
        }
      }
      // Orientation 權限（iOS 13+，tilt/rotate 必需）
      const OrientEventAny = DeviceOrientationEvent as any;
      if (typeof OrientEventAny?.requestPermission === "function") {
        const orientRes = await OrientEventAny.requestPermission();
        if (orientRes !== "granted" && (challengeType === "tilt" || challengeType === "rotate")) {
          setError("需要方向感測器權限，請重新嘗試並允許");
          return;
        }
      }

      // 桌機 / 不支援動作感測器的裝置 fallback
      if (typeof DeviceMotionEvent === "undefined" && challengeType !== "tilt" && challengeType !== "rotate") {
        setError("您的裝置不支援動作感測器，請改用手機遊玩");
        return;
      }

      shakeCountRef.current = 0;
      tiltAngleRef.current = 0;
      lastHitTimeRef.current = 0;
      setProgress(0);
      setHitCount(0);
      setHitPulseKey(0);
      setTimeLeft(config.timeLimit || 30);
      setIsStarted(true);
      setError(null);
    } catch {
      setError("無法取得動作感測器權限，請重新嘗試");
    }
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
            <div className="relative w-20 h-20 mx-auto mb-4">
              <div
                key={hitPulseKey}
                className={`absolute inset-0 rounded-full flex items-center justify-center transition-colors ${
                  isStarted ? "bg-primary/20" : "bg-muted"
                } ${hitPulseKey > 0 ? "motion-hit-pulse" : ""}`}
              >
                <ChallengeIcon
                  className={`w-10 h-10 ${isStarted ? "text-primary" : "text-muted-foreground"}`}
                />
              </div>
              {/* 每次命中浮動 +1 */}
              {hitPulseKey > 0 && (
                <span
                  key={`plus-${hitPulseKey}`}
                  className="motion-plus-one absolute top-0 left-1/2 -translate-x-1/2 text-primary font-bold text-xl pointer-events-none select-none"
                  aria-hidden="true"
                >
                  +1
                </span>
              )}
            </div>
            <h2 className="text-2xl font-display font-bold mb-2">
              {config.title || CHALLENGE_LABELS[challengeType]}
            </h2>
            <p className="text-muted-foreground">
              {config.instruction || `請${CHALLENGE_LABELS[challengeType]}來完成挑戰`}
            </p>
            {isStarted && hitCount > 0 && (
              <p className="text-xs text-primary mt-2 font-mono" data-testid="text-hit-count">
                已偵測 {hitCount} 次
              </p>
            )}
          </div>

          <style>{`
            @keyframes motion-hit-pulse-kf {
              0% { transform: scale(1); box-shadow: 0 0 0 0 hsl(var(--primary) / 0.4); }
              60% { transform: scale(1.15); box-shadow: 0 0 0 18px hsl(var(--primary) / 0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 hsl(var(--primary) / 0); }
            }
            .motion-hit-pulse { animation: motion-hit-pulse-kf 0.5s ease-out; }
            @keyframes motion-plus-one-kf {
              0% { opacity: 0; transform: translate(-50%, 0) scale(0.8); }
              20% { opacity: 1; }
              100% { opacity: 0; transform: translate(-50%, -40px) scale(1.1); }
            }
            .motion-plus-one { animation: motion-plus-one-kf 0.8s ease-out forwards; }
          `}</style>

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
