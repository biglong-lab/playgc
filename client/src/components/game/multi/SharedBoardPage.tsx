// 📋 SharedBoardPage — pageType="shared_board" 容器（L3 持久化版 2026-05-05）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import SharedBoard, { type SharedBoardConfig, type BoardCard } from "./SharedBoard";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface SharedBoardPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface SharedBoardState extends Record<string, unknown> {
  cards: BoardCard[];
}

export default function SharedBoardPage({ page, sessionId, gameId, pageId }: SharedBoardPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: SharedBoardConfig } | SharedBoardConfig | null) ?? null;
  const config: SharedBoardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as SharedBoardConfig | null)) ?? {
      title: "📋 共識牆",
      prompt: "寫下你的想法，大家一起看！",
      maxCardsPerPerson: 3,
    };

  const defaultState: SharedBoardState = { cards: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<SharedBoardState>({
    gameId, sessionId, pageId, type: "shared_board", defaultState,
  });

  const handleAddCard = useCallback(async (text: string, color: string) => {
    const newCard: BoardCard = {
      id: `${myUserId}-${Date.now()}`,
      authorId: myUserId,
      authorName: myUserName,
      text,
      color,
      createdAt: Date.now(),
    };
    await updateState({ cards: [...state.cards, newCard] });
  }, [state.cards, myUserId, myUserName, updateState]);

  const handleDeleteCard = useCallback(async (cardId: string) => {
    const card = state.cards.find((c) => c.id === cardId);
    if (!card || card.authorId !== myUserId) return;
    await updateState({ cards: state.cards.filter((c) => c.id !== cardId) });
  }, [state.cards, myUserId, updateState]);

  if (!isLoaded) {
    return (
      <Card data-testid="shared-board-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <SharedBoard
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onAddCard={handleAddCard}
      onDeleteCard={handleDeleteCard}
    />
  );
}
