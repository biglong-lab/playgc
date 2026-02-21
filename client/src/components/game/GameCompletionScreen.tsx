// 遊戲/章節完成畫面
import { Button } from "@/components/ui/button";
import { Trophy, Home, RefreshCw } from "lucide-react";

interface GameCompletionScreenProps {
  readonly score: number;
  readonly gameTitle: string;
  readonly isChapterMode: boolean;
  readonly chapterTitle?: string;
  readonly gameId: string;
  readonly onPlayAgain: () => void;
  readonly onNavigate: (path: string) => void;
}

export default function GameCompletionScreen({
  score,
  gameTitle,
  isChapterMode,
  chapterTitle,
  gameId,
  onPlayAgain,
  onNavigate,
}: GameCompletionScreenProps) {
  if (isChapterMode) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-glow">
            <Trophy className="w-12 h-12 text-primary" />
          </div>
          <h2 className="text-3xl font-display font-bold mb-2 text-glow">
            章節完成!
          </h2>
          <p className="text-muted-foreground mb-2">
            恭喜完成{chapterTitle ? ` ${chapterTitle}` : "此章節"}
          </p>
          <p className="text-4xl font-number font-bold text-primary mb-8">
            {score} 分
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={onPlayAgain}
              variant="outline"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              重玩本章
            </Button>
            <Button
              onClick={() => onNavigate(`/game/${gameId}/chapters`)}
              className="gap-2"
            >
              <Home className="w-4 h-4" />
              返回章節列表
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md px-4">
        <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 animate-glow">
          <Trophy className="w-12 h-12 text-primary" />
        </div>
        <h2 className="text-3xl font-display font-bold mb-2 text-glow">
          任務完成!
        </h2>
        <p className="text-muted-foreground mb-2">恭喜完成 {gameTitle}</p>
        <p className="text-4xl font-number font-bold text-primary mb-8">
          {score} 分
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={onPlayAgain}
            variant="outline"
            className="gap-2"
            data-testid="button-play-again"
          >
            <RefreshCw className="w-4 h-4" />
            再玩一次
          </Button>
          <Button
            onClick={() => onNavigate("/home")}
            variant="outline"
            className="gap-2"
            data-testid="button-return-home"
          >
            <Home className="w-4 h-4" />
            返回大廳
          </Button>
          <Button
            onClick={() => onNavigate("/leaderboard")}
            className="gap-2"
            data-testid="button-view-leaderboard"
          >
            <Trophy className="w-4 h-4" />
            查看排行榜
          </Button>
        </div>
      </div>
    </div>
  );
}
