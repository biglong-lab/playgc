import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import BucketList, {
  type BucketListConfig,
  type BucketListState,
  type BucketItem,
} from "./BucketList";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface BucketListPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: BucketListConfig = {
  title: "⭐ 集體願望清單",
  prompt: "寫下你想在這次活動實現的事！",
  placeholder: "我想要…",
  maxItemsPerPerson: 3,
  maxItemLength: 40,
  allowSupport: true,
};

const DEFAULT_STATE: BucketListState = { items: [] };

export default function BucketListPage({ page, sessionId, gameId, pageId }: BucketListPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: BucketListConfig } | BucketListConfig | null) ?? null;
  const config: BucketListConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as BucketListConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<BucketListState>({
    gameId,
    sessionId,
    pageId,
    type: "bucket_list",
    defaultState: DEFAULT_STATE,
  });

  const [draftText, setDraftText] = useState("");

  const handleAdd = useCallback(async () => {
    if (!draftText.trim()) return;
    const newItem: BucketItem = {
      id: `${myUserId}-${Date.now()}`,
      userId: myUserId,
      userName: myUserName,
      text: draftText.trim(),
      supporters: [],
      addedAt: Date.now(),
    };
    await updateState({ ...state, items: [...state.items, newItem] });
    setDraftText("");
  }, [state, myUserId, myUserName, draftText, updateState]);

  const handleSupport = useCallback(
    async (itemId: string) => {
      const updated = state.items.map((item: BucketItem) => {
        if (item.id !== itemId) return item;
        if (item.userId === myUserId) return item;
        const has = item.supporters.includes(myUserId);
        const newSupporters = has
          ? item.supporters.filter((s) => s !== myUserId)
          : [...item.supporters, myUserId];
        return { ...item, supporters: newSupporters };
      });
      await updateState({ ...state, items: updated });
    },
    [state, myUserId, updateState],
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
    <BucketList
      config={config}
      state={state}
      myUserId={myUserId}
      draftText={draftText}
      onDraftChange={setDraftText}
      onAdd={handleAdd}
      onSupport={handleSupport}
    />
  );
}
