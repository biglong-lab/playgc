import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Bomb, Check, X, Clock, Zap, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from "lucide-react";
import type { TimeBombConfig } from "@shared/schema";

function directionLabel(dir: "left" | "right" | "up" | "down"): string {
  return { left: "左", right: "右", up: "上", down: "下" }[dir];
}

function DirectionIcon({ dir }: { dir: "left" | "right" | "up" | "down" }) {
  const Icon = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown }[dir];
  return <Icon className="w-16 h-16" />;
}

interface TimeBombPageProps {
  config: TimeBombConfig;
  onComplete: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
  sessionId: string;
  variables: Record<string, any>;
  onVariableUpdate: (key: string, value: unknown) => void;
}

export default function TimeBombPage({ config, onComplete }: TimeBombPageProps) {
  const { toast } = useToast();
  const [timeLeft, setTimeLeft] = useState(config.timeLimit);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [isExploded, setIsExploded] = useState(false);
  const [isDefused, setIsDefused] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [tapCount, setTapCount] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const tasks = config.tasks || [];
  const currentTask = tasks[currentTaskIndex];
  const progress = tasks.length > 0 ? ((currentTaskIndex) / tasks.length) * 100 : 0;

  useEffect(() => {
    if (isExploded || isDefused) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsExploded(true);
          toast({
            title: "💥 時間到!",
            description: config.failureMessage || "炸彈爆炸了!",
            variant: "destructive",
          });
          setTimeout(() => {
            onComplete({ points: 0 }, config.failureNextPageId);
          }, 2000);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExploded, isDefused, config, onComplete, toast]);

  const completeTask = useCallback(() => {
    if (currentTaskIndex >= tasks.length - 1) {
      setIsDefused(true);
      toast({
        title: "炸彈已拆除!",
        description: config.successMessage || "做得好!",
      });
      setTimeout(() => {
        onComplete({ points: config.rewardPoints || 50 }, config.successNextPageId);
      }, 2000);
    } else {
      setCurrentTaskIndex((prev) => prev + 1);
      setInputValue("");
      setTapCount(0);
      setSelectedChoice(null);
    }
  }, [currentTaskIndex, tasks.length, config, onComplete, toast]);

  const handleTap = () => {
    if (!currentTask || currentTask.type !== "tap") return;
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if (newCount >= (currentTask.targetCount || 10)) {
      completeTask();
    }
  };

  const applyPenalty = () => {
    const penalty = config.penaltySeconds ?? 0;
    if (penalty > 0) {
      setTimeLeft((t) => Math.max(0, t - penalty));
    }
  };

  const handleInputSubmit = () => {
    if (!currentTask || currentTask.type !== "input") return;
    if (inputValue.toLowerCase().trim() === (currentTask.answer || "").toLowerCase().trim()) {
      completeTask();
    } else {
      applyPenalty();
      toast({
        title: "答案錯誤",
        description: (config.penaltySeconds ?? 0) > 0
          ? `扣除 ${config.penaltySeconds} 秒！快點再試！`
          : "快點再試一次!",
        variant: "destructive",
      });
      setInputValue("");
    }
  };

  const handleChoiceSelect = (index: number) => {
    if (!currentTask || currentTask.type !== "choice") return;
    setSelectedChoice(index);
    if (index === currentTask.correctIndex) {
      completeTask();
    } else {
      applyPenalty();
      toast({
        title: "選錯了!",
        description: (config.penaltySeconds ?? 0) > 0
          ? `扣除 ${config.penaltySeconds} 秒！快點再選！`
          : "快點再選一次!",
        variant: "destructive",
      });
      setTimeout(() => setSelectedChoice(null), 300);
    }
  };

  // Swipe 任務：記錄觸控起點和終點
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const handleSwipeStart = (e: React.TouchEvent | React.MouseEvent) => {
    const point = "touches" in e ? e.touches[0] : e;
    swipeStartRef.current = { x: point.clientX, y: point.clientY };
  };
  const handleSwipeEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!currentTask || currentTask.type !== "swipe") return;
    const start = swipeStartRef.current;
    if (!start) return;
    const point = "changedTouches" in e ? e.changedTouches[0] : e;
    const dx = point.clientX - start.x;
    const dy = point.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    // 最小滑動距離門檻 50px
    if (absX < 50 && absY < 50) return;

    let direction: "left" | "right" | "up" | "down";
    if (absX > absY) {
      direction = dx > 0 ? "right" : "left";
    } else {
      direction = dy > 0 ? "down" : "up";
    }

    const expected = currentTask.swipeDirection || "right";
    if (direction === expected) {
      completeTask();
    } else {
      applyPenalty();
      toast({
        title: "方向錯誤",
        description: `請往${directionLabel(expected)}滑動！`,
        variant: "destructive",
      });
    }
    swipeStartRef.current = null;
  };

  const getTimeColor = () => {
    if (timeLeft <= 10) return "text-destructive";
    if (timeLeft <= 30) return "text-yellow-500";
    return "text-primary";
  };

  const renderTask = () => {
    if (!currentTask) return null;

    switch (currentTask.type) {
      case "tap":
        return (
          <div className="text-center">
            <p className="text-lg mb-4">{currentTask.question || "快速點擊按鈕!"}</p>
            <Button
              size="lg"
              className="w-32 h-32 rounded-full text-2xl animate-pulse"
              onClick={handleTap}
              data-testid="button-tap"
            >
              <Zap className="w-12 h-12" />
            </Button>
            <p className="mt-4 text-2xl font-mono font-bold">
              {tapCount} / {currentTask.targetCount || 10}
            </p>
          </div>
        );

      case "input":
        return (
          <div className="space-y-4">
            <p className="text-lg text-center">{currentTask.question || "輸入答案!"}</p>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInputSubmit()}
              placeholder="快輸入答案..."
              className="text-center text-lg h-12"
              autoFocus
              data-testid="input-bomb-answer"
            />
            <Button 
              onClick={handleInputSubmit} 
              className="w-full"
              data-testid="button-bomb-submit"
            >
              確認
            </Button>
          </div>
        );

      case "choice":
        return (
          <div className="space-y-3">
            <p className="text-lg text-center mb-4">{currentTask.question || "選擇正確答案!"}</p>
            {(currentTask.options || []).map((option, index) => (
              <Button
                key={index}
                variant={selectedChoice === index ? "default" : "outline"}
                className="w-full h-12 text-lg"
                onClick={() => handleChoiceSelect(index)}
                data-testid={`button-choice-${index}`}
              >
                {option}
              </Button>
            ))}
          </div>
        );

      default:
        return <p>未知任務類型</p>;
    }
  };

  if (isExploded) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-destructive/10">
        <div className="text-8xl mb-4 animate-bounce">💥</div>
        <h2 className="text-3xl font-display font-bold text-destructive mb-2">爆炸了!</h2>
        <p className="text-muted-foreground">{config.failureMessage || "任務失敗"}</p>
      </div>
    );
  }

  if (isDefused) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center p-6 bg-success/10">
        <div className="w-24 h-24 rounded-full bg-success/20 flex items-center justify-center mb-4 animate-scaleIn">
          <Check className="w-12 h-12 text-success" />
        </div>
        <h2 className="text-3xl font-display font-bold text-success mb-2">拆除成功!</h2>
        <p className="text-muted-foreground">{config.successMessage || "做得好!"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 relative">
      <div className={`absolute inset-0 ${timeLeft <= 10 ? "bg-destructive/5 animate-pulse" : ""}`} />
      
      <Card className="w-full max-w-md relative z-10">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bomb className={`w-6 h-6 ${timeLeft <= 10 ? "text-destructive animate-pulse" : "text-primary"}`} />
              <span className="font-display font-bold">{config.title || "拆彈任務"}</span>
            </div>
            <div className={`flex items-center gap-1 font-mono text-2xl font-bold ${getTimeColor()}`}>
              <Clock className="w-5 h-5" />
              {timeLeft}s
            </div>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-1">
              <span>進度</span>
              <span>{currentTaskIndex + 1} / {tasks.length}</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {config.instruction && (
            <p className="text-sm text-muted-foreground text-center mb-6">{config.instruction}</p>
          )}

          <div className="min-h-[200px] flex items-center justify-center">
            {renderTask()}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
