// 💌 WishWallPage — pageType="wish_wall" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import WishWall, { type WishWallConfig, type WishWallState, type WishCard } from "./WishWall";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface WishWallPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function WishWallPage({ page, sessionId, gameId, pageId, onComplete }: WishWallPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: WishWallConfig } | WishWallConfig | null) ?? null;
  const config: WishWallConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as WishWallConfig | null)) ?? {
      title: "💌 祝福牆",
      prompt: "寫下你的祝福…",
      maxLength: 100,
      showAuthor: true,
    };

  const defaultState: WishWallState = { wishes: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<WishWallState>({
    gameId, sessionId, pageId, type: "wish_wall", defaultState,
  });

  const handleSubmit = useCallback(async (message: string, emoji?: string) => {
    const newCard: WishCard = {
      id: Math.random().toString(36).slice(2, 10),
      userId: myUserId,
      userName: myUserName,
      message,
      emoji,
      submittedAt: Date.now(),
    };
    const filtered = state.wishes.filter((w: WishCard) => w.userId !== myUserId);
    await updateState({ wishes: [...filtered, newCard] });
    if (onComplete) onComplete();
  }, [state.wishes, myUserId, myUserName, updateState, onComplete]);

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
    <WishWall
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onSubmit={handleSubmit}
    />
  );
}
