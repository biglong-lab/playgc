// 章節選擇頁面 - 顯示遊戲的所有章節及玩家解鎖狀態
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useChapterProgress } from "@/hooks/useChapterProgress";
import type { Game } from "@shared/schema";
import {
  ArrowLeft,
  Lock,
  Play,
  CheckCircle2,
  Clock,
  Star,
  BookOpen,
  Loader2,
} from "lucide-react";
import OptimizedImage from "@/components/shared/OptimizedImage";

export default function ChapterSelect() {
  const { gameId } = useParams<{ gameId: string }>();
  const [, setLocation] = useLocation();

  const { data: game, isLoading: gameLoading } = useQuery<Game>({
    queryKey: ["/api/games", gameId],
    enabled: !!gameId,
  });

  const {
    chapters,
    progress,
    isLoading: chaptersLoading,
    isChapterUnlocked,
    startChapter,
    isStarting,
  } = useChapterProgress(gameId);

  const handleChapterClick = async (chapterId: string) => {
    if (!isChapterUnlocked(chapterId) || !gameId) return;

    try {
      await startChapter(chapterId);
      setLocation(`/game/${gameId}/chapters/${chapterId}`);
    } catch {
      // 錯誤已由 mutation 處理
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Play className="w-5 h-5 text-amber-500" />;
      case "locked":
        return <Lock className="w-5 h-5 text-muted-foreground" />;
      default:
        return <BookOpen className="w-5 h-5 text-primary" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "in_progress":
        return "進行中";
      case "locked":
        return "未解鎖";
      default:
        return "可開始";
    }
  };

  const getStatusBadgeVariant = (
    status: string
  ): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "in_progress":
        return "secondary";
      case "locked":
        return "outline";
      default:
        return "default";
    }
  };

  if (gameLoading || chaptersLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">遊戲不存在</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 頂部導覽 */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/home")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-display font-bold text-lg">{game.title}</h1>
            {progress && (
              <p className="text-sm text-muted-foreground">
                {progress.completedChapters}/{progress.totalChapters} 章已完成
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 遊戲封面 */}
      {game.coverImageUrl && (
        <div className="relative h-48 max-w-4xl mx-auto overflow-hidden">
          <img
            src={game.coverImageUrl}
            alt={game.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
      )}

      {/* 章節列表 */}
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {chapters.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>尚無章節</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chapters.map((chapter, index) => {
              const status = chapter.playerStatus || "locked";
              const isUnlocked = isChapterUnlocked(chapter.id);

              return (
                <Card
                  key={chapter.id}
                  className={`overflow-hidden transition-all ${
                    isUnlocked
                      ? "cursor-pointer hover-elevate"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                  onClick={() => handleChapterClick(chapter.id)}
                >
                  {/* 章節封面 */}
                  {chapter.coverImageUrl && (
                    <div className="relative h-32 overflow-hidden">
                      <img
                        src={chapter.coverImageUrl}
                        alt={chapter.title}
                        className="w-full h-full object-cover"
                      />
                      {!isUnlocked && (
                        <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                          <Lock className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                  )}

                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(status)}
                        <div>
                          <p className="text-xs text-muted-foreground">
                            第 {index + 1} 章
                          </p>
                          <h3 className="font-bold">{chapter.title}</h3>
                        </div>
                      </div>
                      <Badge variant={getStatusBadgeVariant(status)}>
                        {getStatusLabel(status)}
                      </Badge>
                    </div>

                    {chapter.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {chapter.description}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {chapter.estimatedTime && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{chapter.estimatedTime} 分鐘</span>
                        </div>
                      )}
                      {chapter.bestScore > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          <span>最佳 {chapter.bestScore} 分</span>
                        </div>
                      )}
                    </div>

                    {/* 解鎖條件提示 */}
                    {!isUnlocked && chapter.unlockType && (
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {chapter.unlockType === "complete_previous" &&
                          "完成前一章後解鎖"}
                        {chapter.unlockType === "score_threshold" &&
                          "達到指定分數後解鎖"}
                        {chapter.unlockType === "paid" && "需要購買解鎖"}
                      </p>
                    )}

                    {/* 操作按鈕 */}
                    {isUnlocked && (
                      <Button
                        className="w-full mt-3 gap-2"
                        size="sm"
                        disabled={isStarting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleChapterClick(chapter.id);
                        }}
                      >
                        {isStarting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : status === "completed" ? (
                          <>
                            <Play className="w-4 h-4" />
                            重玩
                          </>
                        ) : status === "in_progress" ? (
                          <>
                            <Play className="w-4 h-4" />
                            繼續
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            開始
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
