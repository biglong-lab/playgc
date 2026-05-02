// 🚀 ProgressQuestPage — GamePageRenderer 用此元件對應 pageType="host_progress_quest"
// 設計依據：docs/decisions/0013-w18-component-expansion.md

import { useCallback } from "react";
import ProgressQuest, {
  type ProgressQuestConfig,
  type ProgressQuestState,
  buildInitialProgressState,
  calculateProgress,
  detectNewMilestones,
} from "./ProgressQuest";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

const DEFAULT_MILESTONES = [25, 50, 75, 100];

interface ProgressQuestPageProps {
  page: Page;
}

export default function ProgressQuestPage({ page }: ProgressQuestPageProps) {
  const rawConfig = (page.config as { config?: ProgressQuestConfig } | ProgressQuestConfig | null) ?? null;
  const config: ProgressQuestConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as ProgressQuestConfig | null)) ?? {};
  const milestones = config.milestones ?? DEFAULT_MILESTONES;

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: ProgressQuestState | null,
    ): ProgressQuestState | null => {
      if (pulseType !== "complete") return null;

      const userId = (payload as { userId?: string })?.userId?.trim();
      if (!userId) return null;

      const baseState = currentState ?? buildInitialProgressState(config);

      // 已達 100%、不再推進
      if (baseState.completed >= baseState.totalTasks) return null;

      const prevPercent = calculateProgress(baseState.completed, baseState.totalTasks);
      const newCompleted = baseState.completed + 1;
      const newPercent = calculateProgress(newCompleted, baseState.totalTasks);

      const newMilestones = detectNewMilestones(prevPercent, newPercent, milestones);
      const milestonesReached = [
        ...baseState.milestonesReached,
        ...newMilestones.filter((m) => !baseState.milestonesReached.includes(m)),
      ];

      return {
        ...baseState,
        completed: newCompleted,
        contributors: {
          ...baseState.contributors,
          [userId]: (baseState.contributors[userId] ?? 0) + 1,
        },
        milestonesReached,
      };
    },
    [config, milestones],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<ProgressQuestState>({
    onPulse: handlePulse,
  });

  return (
    <ProgressQuest
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
