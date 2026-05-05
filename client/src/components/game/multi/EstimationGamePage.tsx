import { useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import EstimationGame, {
  type EstimationGameConfig,
  type EstimationGameState,
  type EstimationEntry,
} from "./EstimationGame";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface EstimationGamePageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

const DEFAULT_CONFIG: EstimationGameConfig = {
  title: "🃏 規劃撲克",
  question: "這個功能需要多少天完成？",
  unit: "天",
  options: ["1", "2", "3", "5", "8", "13", "21", "?"],
  showAverage: true,
  showAllEstimates: true,
};

const DEFAULT_STATE: EstimationGameState = { entries: [], revealed: false };

export default function EstimationGamePage({ page, sessionId, gameId, pageId }: EstimationGamePageProps) {
  const { user } = useAuth();
  const myUserId = user?.id ?? "anonymous";
  const myUserName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const rawConfig = (page.config as { config?: EstimationGameConfig } | EstimationGameConfig | null) ?? null;
  const config: EstimationGameConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as EstimationGameConfig | null)) ?? DEFAULT_CONFIG;

  const { state, updateState, isLoaded } = useTeamPagePersistence<EstimationGameState>({
    gameId,
    sessionId,
    pageId,
    type: "estimation_game",
    defaultState: DEFAULT_STATE,
  });

  const [localValue, setLocalValue] = useState<string>("");

  const handleSelectValue = useCallback((value: string) => {
    setLocalValue(value);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!localValue) return;
    if (state.entries.some((e: EstimationEntry) => e.userId === myUserId)) return;
    const newEntry: EstimationEntry = {
      userId: myUserId,
      userName: myUserName,
      value: localValue,
      submittedAt: Date.now(),
    };
    await updateState({ ...state, entries: [...state.entries, newEntry] });
  }, [state, myUserId, myUserName, localValue, updateState]);

  const handleReveal = useCallback(async () => {
    if (state.revealed) return;
    await updateState({ ...state, revealed: true });
  }, [state, updateState]);

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
    <EstimationGame
      config={config}
      state={state}
      myUserId={myUserId}
      localValue={localValue}
      onSelectValue={handleSelectValue}
      onSubmit={handleSubmit}
      onReveal={handleReveal}
    />
  );
}
