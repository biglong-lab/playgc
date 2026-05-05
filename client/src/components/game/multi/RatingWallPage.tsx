// ⭐ RatingWallPage — pageType="rating_wall" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import RatingWall, { type RatingWallConfig, type RatingWallState, type RatingEntry } from "./RatingWall";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface RatingWallPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function RatingWallPage({ page, sessionId, gameId, pageId, onComplete }: RatingWallPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: RatingWallConfig } | RatingWallConfig | null) ?? null;
  const config: RatingWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as RatingWallConfig | null)) ?? {
      title: "⭐ 作品評分",
      items: [
        { id: "i1", label: "第一組", emoji: "🔵" },
        { id: "i2", label: "第二組", emoji: "🔴" },
        { id: "i3", label: "第三組", emoji: "🟢" },
      ],
      showResults: true,
    };

  const defaultState: RatingWallState = { ratings: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<RatingWallState>({
    gameId, sessionId, pageId, type: "rating_wall", defaultState,
  });

  const handleRate = useCallback(async (itemId: string, stars: number) => {
    const newEntry: RatingEntry = {
      userId: myUserId,
      itemId,
      stars,
      ratedAt: Date.now(),
    };
    const filtered = state.ratings.filter(
      (r: RatingEntry) => !(r.userId === myUserId && r.itemId === itemId)
    );
    const updated = [...filtered, newEntry];
    await updateState({ ratings: updated });

    const totalItems = config.items.length;
    const myRatings = updated.filter((r: RatingEntry) => r.userId === myUserId);
    if (myRatings.length >= totalItems && onComplete) {
      onComplete();
    }
  }, [state.ratings, myUserId, config.items.length, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <RatingWall
      config={config}
      state={state}
      myUserId={myUserId}
      onRate={handleRate}
    />
  );
}
