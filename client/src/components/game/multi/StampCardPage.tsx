// 🎴 StampCardPage — pageType="stamp_card" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import StampCard, { type StampCardConfig, type StampCardState, type MyStamps } from "./StampCard";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface StampCardPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

export default function StampCardPage({ page, sessionId, gameId, pageId, onComplete }: StampCardPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName || user?.email?.split("@")[0] || "玩家";

  const rawConfig = (page.config as { config?: StampCardConfig } | StampCardConfig | null) ?? null;
  const config: StampCardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as StampCardConfig | null)) ?? {
      title: "🎴 集點卡",
      slots: [
        { id: "s1", label: "任務一", emoji: "⭐" },
        { id: "s2", label: "任務二", emoji: "⭐" },
        { id: "s3", label: "任務三", emoji: "⭐" },
      ],
    };

  const defaultState: StampCardState = { stamps: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<StampCardState>({
    gameId, sessionId, pageId, type: "stamp_card", defaultState,
  });

  const handleStamp = useCallback(async (slotId: string) => {
    const existing = state.stamps.find((s: MyStamps) => s.userId === myUserId);
    const stampedIds = existing ? [...existing.stampedIds] : [];
    if (stampedIds.includes(slotId)) return;
    stampedIds.push(slotId);

    const total = config.slots.length;
    const isNowComplete = stampedIds.length >= total;
    const updated: MyStamps = {
      userId: myUserId,
      userName: myUserName,
      stampedIds,
      ...(isNowComplete ? { completedAt: Date.now() } : {}),
    };
    const filtered = state.stamps.filter((s: MyStamps) => s.userId !== myUserId);
    await updateState({ stamps: [...filtered, updated] });
    if (isNowComplete && onComplete) onComplete();
  }, [state.stamps, myUserId, myUserName, config.slots.length, updateState, onComplete]);

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
    <StampCard
      config={config}
      state={state}
      myUserId={myUserId}
      myUserName={myUserName}
      onStamp={handleStamp}
    />
  );
}
