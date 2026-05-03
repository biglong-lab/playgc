// 📺 BlessingWallPage — GamePageRenderer 對應 pageType="host_blessing_wall"
// 設計依據：docs/decisions/0004-host-screen-axis.md + docs/manual/01-host-components.md

import { useCallback, useMemo } from "react";
import BlessingWall, { type BlessingWallConfig, type BlessingWallState, type BlessingItem, type FlyingBlessing } from "./BlessingWall";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface BlessingWallPageProps {
  page: Page;
}

const MAX_BLESSINGS = 100;
const MAX_FLYING = 30;

export default function BlessingWallPage({ page }: BlessingWallPageProps) {
  const config = useMemo<BlessingWallConfig>(() => {
    const raw = (page.config as { config?: BlessingWallConfig } | BlessingWallConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as BlessingWallConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: BlessingWallState | null,
    ): BlessingWallState | null => {
      if (pulseType !== "blessing") return null;
      const data = payload as { name?: string; message?: string; emoji?: string };
      if (!data?.name || !data?.message) return null;

      const baseState: BlessingWallState = currentState ?? { blessings: [], recentFlying: [] };

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const item: BlessingItem = {
        id,
        name: data.name.slice(0, 20),
        message: data.message.slice(0, 100),
        emoji: data.emoji,
        addedAt: Date.now(),
      };

      const flying: FlyingBlessing = {
        ...item,
        x: 10 + Math.floor(Math.random() * 80),
        startedAt: Date.now(),
      };

      return {
        blessings: [...baseState.blessings, item].slice(-MAX_BLESSINGS),
        recentFlying: [...baseState.recentFlying, flying].slice(-MAX_FLYING),
      };
    },
    [],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<BlessingWallState>({
    onPulse: handlePulse,
  });

  return (
    <BlessingWall
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
