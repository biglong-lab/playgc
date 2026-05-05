// ✅ TeamChecklistPage — pageType="team_checklist" 容器（L3 持久化）

import { useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import TeamChecklist, { type TeamChecklistConfig } from "./TeamChecklist";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import type { Page } from "@shared/schema";

interface TeamChecklistPageProps {
  page: Page;
  sessionId: string;
  gameId: string;
  pageId: string;
  onComplete?: (reward?: { points?: number; items?: string[] }, nextPageId?: string) => void;
}

interface TeamChecklistState extends Record<string, unknown> {
  checked: string[];
}

export default function TeamChecklistPage({ page, sessionId, gameId, pageId, onComplete }: TeamChecklistPageProps) {
  const rawConfig = (page.config as { config?: TeamChecklistConfig } | TeamChecklistConfig | null) ?? null;
  const config: TeamChecklistConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as TeamChecklistConfig | null)) ?? {
      title: "✅ 隊伍清單",
      items: ["任務一", "任務二", "任務三"],
      winOnComplete: true,
    };

  const defaultState: TeamChecklistState = { checked: [] };

  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamChecklistState>({
    gameId, sessionId, pageId, type: "team_checklist", defaultState,
  });

  const handleToggle = useCallback(async (item: string) => {
    const isChecked = state.checked.includes(item);
    const newChecked = isChecked
      ? state.checked.filter((c) => c !== item)
      : [...state.checked, item];
    await updateState({ checked: newChecked });

    if (!isChecked && config.winOnComplete !== false) {
      const allDone = config.items.every((it) => newChecked.includes(it));
      if (allDone && onComplete) onComplete();
    }
  }, [state.checked, config.items, config.winOnComplete, updateState, onComplete]);

  if (!isLoaded) {
    return (
      <Card data-testid="team-checklist-loading">
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <TeamChecklist
      config={config}
      state={state}
      onToggle={handleToggle}
    />
  );
}
