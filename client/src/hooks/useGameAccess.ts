// 遊戲存取權查詢 Hook
import { useQuery } from "@tanstack/react-query";

interface ChapterAccess {
  chapterId: string;
  chapterOrder: number;
  title: string;
  hasAccess: boolean;
}

interface GameAccessData {
  hasAccess: boolean;
  pricingType: "free" | "one_time" | "per_chapter";
  purchaseType?: string;
  price?: number;
  currency?: string;
  chapters?: ChapterAccess[];
}

export function useGameAccess(gameId: string | undefined) {
  return useQuery<GameAccessData>({
    queryKey: [`/api/games/${gameId}/access`],
    enabled: !!gameId,
  });
}
