// 🏷️ NameCardPage — pageType="name_card" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import NameCard, { type NameCardConfig, type NameCardState, type NameCardEntry } from "./NameCard";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface NameCardPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function NameCardPage({ page, sessionId, gameId, pageId, onComplete }: NameCardPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: NameCardConfig } | NameCardConfig | null) ?? null;
  const config: NameCardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as NameCardConfig | null)) ?? {
      title: "🏷️ 自我介紹牌",
      fields: [
        { key: "name", label: "你的名字", placeholder: "你的名字", maxLength: 20 },
        { key: "role", label: "你的角色 / 職位", placeholder: "如：工程師、學生…", maxLength: 30 },
        { key: "fact", label: "一件有趣的事", placeholder: "如：我養了一隻貓…（選填）", maxLength: 40 },
      ],
    };

  const defaultState: NameCardState = { cards: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<NameCardState>({
    gameId, sessionId, pageId, type: "name_card", defaultState,
  });

  const handleSubmit = useCallback(async (fields: Record<string, string>, emoji?: string) => {
    const newCard: NameCardEntry = {
      id: Math.random().toString(36).slice(2, 10),
      userId: myUserId,
      fields,
      emoji,
      submittedAt: Date.now(),
    };
    const filtered = state.cards.filter((c: NameCardEntry) => c.userId !== myUserId);
    await updateState({ cards: [...filtered, newCard] });
    if (onComplete) onComplete();
  }, [state.cards, myUserId, updateState, onComplete]);

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
    <NameCard
      config={config}
      state={state}
      myUserId={myUserId}
      onSubmit={handleSubmit}
    />
  );
}
