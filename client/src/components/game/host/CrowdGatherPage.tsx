// 📺 CrowdGatherPage — GamePageRenderer 對應 pageType="host_crowd_gather"

import { useCallback } from "react";
import CrowdGather, { type CrowdGatherConfig } from "./CrowdGather";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface CrowdGatherPageProps {
  page: Page;
}

interface CheckinEntry {
  name: string;
  ts: number;
}

interface CrowdGatherStateShape {
  registered: CheckinEntry[];
  totalCount: number;
  isReached: boolean;
}

export default function CrowdGatherPage({ page }: CrowdGatherPageProps) {
  const rawConfig = (page.config as { config?: CrowdGatherConfig } | CrowdGatherConfig | null) ?? null;
  const config: CrowdGatherConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as CrowdGatherConfig | null)) ?? {};
  const targetCount = Math.max(1, config.targetCount ?? 10);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: CrowdGatherStateShape | null,
    ): CrowdGatherStateShape | null => {
      if (pulseType !== "checkin") return null;
      const name = ((payload as { name?: string })?.name ?? "匿名").slice(0, 20);

      const baseState: CrowdGatherStateShape = currentState ?? {
        registered: [],
        totalCount: 0,
        isReached: false,
      };

      // 達標後不再接受新簽到（避免無限增長 + 防 spam）
      if (baseState.isReached) return baseState;

      const newEntry: CheckinEntry = { name, ts: Date.now() };
      const newRegistered = [...baseState.registered, newEntry];
      const newTotalCount = baseState.totalCount + 1;
      const isReached = newTotalCount >= targetCount;

      return {
        registered: newRegistered.slice(-100), // 最多保留 100 筆（避免 state 爆炸）
        totalCount: newTotalCount,
        isReached,
      };
    },
    [targetCount],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<CrowdGatherStateShape>({
    onPulse: handlePulse,
  });

  return (
    <CrowdGather
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
