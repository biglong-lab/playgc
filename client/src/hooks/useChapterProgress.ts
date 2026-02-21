// 章節進度 hook - 封裝章節列表查詢和玩家進度
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { GameChapter, ChapterProgressSummary } from "@shared/schema";

interface ChapterWithProgress extends GameChapter {
  playerStatus: string;
  bestScore: number;
  completedAt: string | null;
  lastPlayedAt: string | null;
  unlockDetail?: {
    requiredScore?: number;
    currentScore?: number;
    price?: number;
  };
}

export function useChapterProgress(gameId: string | undefined) {
  const { data: chapters, isLoading: chaptersLoading } = useQuery<
    ChapterWithProgress[]
  >({
    queryKey: ["/api/games", gameId, "chapters"],
    enabled: !!gameId,
  });

  const { data: progress, isLoading: progressLoading } =
    useQuery<ChapterProgressSummary>({
      queryKey: ["/api/games", gameId, "progress"],
      enabled: !!gameId,
    });

  const startChapterMutation = useMutation({
    mutationFn: async (chapterId: string) => {
      const res = await apiRequest(
        "POST",
        `/api/games/${gameId}/chapters/${chapterId}/start`
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/games", gameId, "chapters"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/games", gameId, "progress"],
      });
    },
  });

  const isChapterUnlocked = (chapterId: string): boolean => {
    if (!chapters) return false;
    const chapter = chapters.find((c) => c.id === chapterId);
    if (!chapter) return false;
    return (
      chapter.playerStatus === "unlocked" ||
      chapter.playerStatus === "in_progress" ||
      chapter.playerStatus === "completed"
    );
  };

  return {
    chapters: chapters ?? [],
    progress,
    isLoading: chaptersLoading || progressLoading,
    isChapterUnlocked,
    startChapter: startChapterMutation.mutateAsync,
    isStarting: startChapterMutation.isPending,
  };
}
