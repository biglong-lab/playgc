// 📺 BingoBoardPage — GamePageRenderer 用此元件對應 pageType="host_bingo_board"
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md

import { useCallback, useMemo } from "react";
import BingoBoard, { type BingoBoardConfig, type BingoBoardState, computeLines } from "./BingoBoard";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface BingoBoardPageProps {
  page: Page;
}

const DEFAULT_TASKS: BingoBoardConfig["tasks"] = Array.from({ length: 25 }, (_, i) => ({
  id: `t-${i + 1}`,
  label: `任務 ${i + 1}`,
}));

export default function BingoBoardPage({ page }: BingoBoardPageProps) {
  const config = useMemo<BingoBoardConfig>(() => {
    const raw = (page.config as { config?: BingoBoardConfig } | BingoBoardConfig | null) ?? null;
    const merged = (raw && "config" in raw ? raw.config : (raw as BingoBoardConfig | null)) ?? {
      tasks: DEFAULT_TASKS,
    };
    return {
      ...merged,
      tasks: merged.tasks?.length ? merged.tasks : DEFAULT_TASKS,
    };
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: BingoBoardState | null,
    ): BingoBoardState | null => {
      if (pulseType !== "task_complete") return null;
      const taskId = (payload as { taskId?: string })?.taskId;
      if (!taskId) return null;

      const task = config.tasks.find((t) => t.id === taskId);
      if (!task) return null;

      const baseState: BingoBoardState = currentState ?? {
        completed: {},
        claimedLines: [],
        totalParticipants: 0,
      };

      const newCount = (baseState.completed[taskId] ?? 0) + 1;
      const completed = { ...baseState.completed, [taskId]: newCount };

      const rows = config.rows ?? 5;
      const cols = config.cols ?? 5;
      const totalCells = rows * cols;

      const completedCellIndices = new Set<number>();
      for (let i = 0; i < totalCells; i++) {
        const t = config.tasks[i];
        if (!t) continue;
        const count = completed[t.id] ?? 0;
        if (count >= (t.requiredCount ?? 1)) completedCellIndices.add(i);
      }

      const lines = computeLines(rows, cols);
      const claimedLines = lines
        .filter((line) => line.cells.every((idx) => completedCellIndices.has(idx)))
        .map((l) => l.id);

      return {
        completed,
        claimedLines,
        totalParticipants: baseState.totalParticipants + (newCount === 1 ? 1 : 0),
      };
    },
    [config],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<BingoBoardState>({
    onPulse: handlePulse,
  });

  return (
    <BingoBoard
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
