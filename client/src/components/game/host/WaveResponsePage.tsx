// 📺 WaveResponsePage — GamePageRenderer 對應 pageType="host_wave_response"

import { useCallback, useMemo } from "react";
import WaveResponse, { type WaveResponseConfig } from "./WaveResponse";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface WaveResponsePageProps {
  page: Page;
}

interface WaveResponseStateShape {
  totalTaps: number;
  bucketBySec: Record<string, number>;
}

const BUCKET_WINDOW_SEC = 30;

export default function WaveResponsePage({ page }: WaveResponsePageProps) {
  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<WaveResponseConfig>(() => {
    const raw = (page.config as { config?: WaveResponseConfig } | WaveResponseConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as WaveResponseConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      _payload: unknown,
      currentState: WaveResponseStateShape | null,
    ): WaveResponseStateShape | null => {
      if (pulseType !== "tap") return null;
      const baseState: WaveResponseStateShape = currentState ?? {
        totalTaps: 0,
        bucketBySec: {},
      };
      const sec = Math.floor(Date.now() / 1000).toString();
      const newBucketBySec = { ...baseState.bucketBySec };
      newBucketBySec[sec] = (newBucketBySec[sec] ?? 0) + 1;

      // 清掉超過 30 秒的舊 bucket（避免 state 無限長大）
      const cutoff = Math.floor(Date.now() / 1000) - BUCKET_WINDOW_SEC;
      Object.keys(newBucketBySec).forEach((k) => {
        if (parseInt(k, 10) < cutoff) delete newBucketBySec[k];
      });

      return {
        totalTaps: baseState.totalTaps + 1,
        bucketBySec: newBucketBySec,
      };
    },
    [],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<WaveResponseStateShape>({
    onPulse: handlePulse,
  });

  return (
    <WaveResponse
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
