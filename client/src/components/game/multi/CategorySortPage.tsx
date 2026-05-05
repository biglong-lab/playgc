import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CategorySort, {
  type CategorySortConfig,
  type CategorySortState,
  type UserSort,
} from "./CategorySort";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface CategorySortPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: CategorySortConfig = {
  title: "🗂️ 卡片分類",
  instructions: "請將每個項目拖放到最合適的分類",
  items: [
    { id: "i1", label: "每日站立會議" },
    { id: "i2", label: "衝刺規劃" },
    { id: "i3", label: "系統架構圖" },
    { id: "i4", label: "程式碼審查" },
    { id: "i5", label: "部署流程" },
    { id: "i6", label: "回顧會議" },
  ],
  categories: [
    { id: "c1", label: "流程", color: "#3B82F6" },
    { id: "c2", label: "技術", color: "#10B981" },
    { id: "c3", label: "團隊", color: "#F59E0B" },
  ],
  showConsensus: true,
};

const DEFAULT_STATE: CategorySortState = { sorts: [] };

export default function CategorySortPage({ page, sessionId, gameId, pageId }: CategorySortPageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: CategorySortConfig } | CategorySortConfig | null) ?? null;
  const config: CategorySortConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CategorySortConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<CategorySortState>({
    gameId,
    sessionId,
    pageId,
    type: "category_sort",
    defaultState: DEFAULT_STATE,
  });

  const [localAssignments, setLocalAssignments] = useState<Record<string, string>>({});

  const handleAssign = useCallback((itemId: string, categoryId: string) => {
    setLocalAssignments((prev) => ({ ...prev, [itemId]: categoryId }));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (state.sorts.some((s: UserSort) => s.userId === myUserId)) return;
    const assignments = config.items
      .filter((item) => localAssignments[item.id])
      .map((item) => ({ itemId: item.id, categoryId: localAssignments[item.id] }));
    const newSort: UserSort = {
      userId: myUserId,
      userName: myUserName,
      assignments,
      submittedAt: Date.now(),
    };
    await updateState({ ...state, sorts: [...state.sorts, newSort] });
  }, [state, myUserId, myUserName, localAssignments, config.items, updateState]);

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
    <CategorySort
      config={config}
      state={state}
      myUserId={myUserId}
      localAssignments={localAssignments}
      onAssign={handleAssign}
      onSubmit={handleSubmit}
    />
  );
}
