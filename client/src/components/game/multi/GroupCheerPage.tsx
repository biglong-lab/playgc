import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GroupCheer from "./GroupCheer";
import type { GroupCheerConfig, GroupCheerState } from "./GroupCheer";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface GroupCheerPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: GroupCheerConfig = {
  title: "💪 集體應援",
  goal: 500,
  tapEmoji: "👏",
  celebrateMessage: "太厲害了！大家一起做到了！",
};

const DEFAULT_STATE: GroupCheerState = {
  totalTaps: 0,
  tapsByUser: {},
};

export default function GroupCheerPage({ page, sessionId, gameId, pageId }: GroupCheerPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";

  const rawConfig = (page.config as { config?: GroupCheerConfig } | GroupCheerConfig | null) ?? null;
  const config: GroupCheerConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as GroupCheerConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<GroupCheerState>({
    gameId,
    sessionId,
    pageId,
    type: "group_cheer",
    defaultState: DEFAULT_STATE,
  });

  const handleTap = useCallback(async () => {
    const myPrev = (state.tapsByUser as Record<string, number>)[myUserId] ?? 0;
    await updateState({
      ...state,
      totalTaps: state.totalTaps + 1,
      tapsByUser: { ...state.tapsByUser, [myUserId]: myPrev + 1 },
    });
  }, [state, myUserId, updateState]);

  if (!isLoaded) {
    return (
      <Card className="m-4">
        <CardContent className="flex items-center gap-2 py-4">
          <Loader2 className="animate-spin w-4 h-4" />
          <span>載入中…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <GroupCheer
      config={config}
      state={state}
      myUserId={myUserId}
      onTap={handleTap}
    />
  );
}
