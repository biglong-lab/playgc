import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Trophy, 
  TrendingUp, 
  TrendingDown, 
  Star,
  Target,
  Clock,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ScoreHistoryItem {
  id: string;
  delta: number;
  runningTotal: number;
  sourceType: string;
  description: string;
  createdAt: string;
}

interface TeamScoreDisplayProps {
  teamName: string;
  currentScore: number;
  targetScore?: number;
  scoreHistory?: ScoreHistoryItem[];
  onScoreChange?: (newScore: number, delta: number) => void;
  showAnimation?: boolean;
  compact?: boolean;
}

export function TeamScoreDisplay({
  teamName,
  currentScore,
  targetScore,
  scoreHistory = [],
  onScoreChange,
  showAnimation = true,
  compact = false,
}: TeamScoreDisplayProps) {
  const [displayScore, setDisplayScore] = useState(currentScore);
  const [isAnimating, setIsAnimating] = useState(false);
  const [lastDelta, setLastDelta] = useState<number | null>(null);

  useEffect(() => {
    if (currentScore !== displayScore && showAnimation) {
      const delta = currentScore - displayScore;
      setLastDelta(delta);
      setIsAnimating(true);
      
      const steps = Math.min(Math.abs(delta), 20);
      const stepValue = delta / steps;
      let step = 0;
      
      const interval = setInterval(() => {
        step++;
        setDisplayScore(prev => {
          const next = prev + stepValue;
          if (step >= steps) {
            clearInterval(interval);
            setIsAnimating(false);
            return currentScore;
          }
          return next;
        });
      }, 50);
      
      return () => clearInterval(interval);
    } else {
      setDisplayScore(currentScore);
    }
  }, [currentScore, showAnimation]);

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "page_completion":
        return <Target className="w-3 h-3" />;
      case "vote_result":
        return <Star className="w-3 h-3" />;
      case "random_event":
        return <Zap className="w-3 h-3" />;
      case "time_bonus":
        return <Clock className="w-3 h-3" />;
      default:
        return <Trophy className="w-3 h-3" />;
    }
  };

  const progressPercent = targetScore ? Math.min((currentScore / targetScore) * 100, 100) : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        <span className={cn(
          "font-mono font-bold text-lg transition-all duration-200",
          isAnimating && lastDelta && lastDelta > 0 && "text-green-500 scale-110",
          isAnimating && lastDelta && lastDelta < 0 && "text-red-500 scale-110",
        )}>
          {Math.round(displayScore)}
        </span>
        {isAnimating && lastDelta && (
          <Badge 
            variant={lastDelta > 0 ? "default" : "destructive"} 
            className="animate-bounce text-xs"
          >
            {lastDelta > 0 ? "+" : ""}{lastDelta}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <span>{teamName}</span>
          </div>
          <div className={cn(
            "flex items-center gap-2 transition-all duration-300",
            isAnimating && lastDelta && lastDelta > 0 && "text-green-500",
            isAnimating && lastDelta && lastDelta < 0 && "text-red-500",
          )}>
            <span className="font-mono text-2xl font-bold">
              {Math.round(displayScore)}
            </span>
            {isAnimating && lastDelta && (
              <div className="flex items-center gap-1 animate-bounce">
                {lastDelta > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
                <span className="text-sm font-mono">
                  {lastDelta > 0 ? "+" : ""}{lastDelta}
                </span>
              </div>
            )}
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {targetScore && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">目標分數</span>
              <span className="font-mono">{currentScore} / {targetScore}</span>
            </div>
            <Progress value={progressPercent} className="h-2" />
          </div>
        )}

        {scoreHistory.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">最近得分</div>
            <ScrollArea className="h-32">
              <div className="space-y-2">
                {scoreHistory.slice(0, 10).map((item) => (
                  <div 
                    key={item.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {getSourceIcon(item.sourceType)}
                      <span className="text-muted-foreground truncate max-w-[150px]">
                        {item.description || item.sourceType}
                      </span>
                    </div>
                    <Badge 
                      variant={item.delta >= 0 ? "secondary" : "destructive"}
                      className="font-mono"
                    >
                      {item.delta >= 0 ? "+" : ""}{item.delta}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
