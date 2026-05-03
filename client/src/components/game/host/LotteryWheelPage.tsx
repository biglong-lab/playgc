// 🎯 LotteryWheelPage — GamePageRenderer 用此元件對應 pageType="host_lottery_wheel"
// 設計依據：docs/decisions/0013-w18-component-expansion.md

import { useCallback, useMemo } from "react";
import LotteryWheel, {
  type LotteryWheelConfig,
  type LotteryWheelState,
  buildInitialLotteryState,
} from "./LotteryWheel";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface LotteryWheelPageProps {
  page: Page;
}

export default function LotteryWheelPage({ page }: LotteryWheelPageProps) {
  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<LotteryWheelConfig>(() => {
    const raw = (page.config as { config?: LotteryWheelConfig } | LotteryWheelConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as LotteryWheelConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: LotteryWheelState | null,
    ): LotteryWheelState | null => {
      const baseState = currentState ?? buildInitialLotteryState(config);

      // 玩家報名
      if (pulseType === "join") {
        const name = (payload as { name?: string })?.name?.trim();
        if (!name) return null;
        // 不重複（同名 → 加 suffix）
        let label = name;
        let suffix = 1;
        while (baseState.items.some((i) => i.label === label)) {
          suffix++;
          label = `${name} (${suffix})`;
        }
        const newItem = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label,
        };
        return {
          ...baseState,
          items: [...baseState.items, newItem],
        };
      }

      // admin 觸發旋轉（W18+ 補管理介面）
      if (pulseType === "spin") {
        if (baseState.items.length === 0) return null;
        if (baseState.spinning) return null;
        // 隨機選一個 winner（公平）
        const winnerIdx = Math.floor(Math.random() * baseState.items.length);
        return {
          ...baseState,
          spinning: true,
          winnerId: baseState.items[winnerIdx].id,
          spinStartedAt: Date.now(),
        };
      }

      // 旋轉結束（client 端計時觸發）
      if (pulseType === "stop") {
        return {
          ...baseState,
          spinning: false,
        };
      }

      return null;
    },
    [config],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<LotteryWheelState>({
    onPulse: handlePulse,
  });

  return (
    <LotteryWheel
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
