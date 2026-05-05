import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import HotTake from "./HotTake";
import type { HotTakeConfig, HotTakeState, HotTakeItem } from "./HotTake";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface HotTakePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: HotTakeConfig = {
  title: "🔥 熱議話題",
  instructions: "說出你最有爭議的想法，讓大家用 emoji 表態！",
  maxLength: 80,
  maxTakesPerPerson: 2,
  reactions: ["🔥", "💯", "🤔", "❄️", "💀"],
};

const DEFAULT_STATE: HotTakeState = { takes: [] };

export default function HotTakePage({ page, sessionId, gameId, pageId }: HotTakePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: HotTakeConfig } | HotTakeConfig | null) ?? null;
  const config: HotTakeConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as HotTakeConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<HotTakeState>({
    gameId,
    sessionId,
    pageId,
    type: "hot_take",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handleDraftChange = useCallback((text: string) => {
    setDraftText(text);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = draftText.trim();
    if (!trimmed || !myUserId) return;
    const myCount = state.takes.filter((t: HotTakeItem) => t.authorId === myUserId).length;
    if (myCount >= config.maxTakesPerPerson) return;
    const newTake: HotTakeItem = {
      id: `${myUserId}-${Date.now()}`,
      text: trimmed,
      authorId: myUserId,
      authorName: myUserName,
      reactions: {},
      submittedAt: Date.now(),
    };
    await updateState({ ...state, takes: [...state.takes, newTake] });
    setDraftText("");
  }, [draftText, myUserId, myUserName, state, updateState, config.maxTakesPerPerson]);

  const handleReact = useCallback(
    async (takeId: string, emoji: string) => {
      const takes = state.takes.map((t: HotTakeItem) => {
        if (t.id !== takeId) return t;
        const current = t.reactions[emoji] ?? [];
        const updated = current.includes(myUserId)
          ? current.filter((id) => id !== myUserId)
          : [...current, myUserId];
        return { ...t, reactions: { ...t.reactions, [emoji]: updated } };
      });
      await updateState({ ...state, takes });
    },
    [myUserId, state, updateState]
  );

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
    <HotTake
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={handleDraftChange}
      onSubmit={handleSubmit}
      onReact={handleReact}
    />
  );
}
