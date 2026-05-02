// 📺 LiveLeaderboardPage — GamePageRenderer 對應 pageType="host_live_leaderboard"

import { useCallback } from "react";
import LiveLeaderboard, { type LiveLeaderboardConfig } from "./LiveLeaderboard";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface LiveLeaderboardPageProps {
  page: Page;
}

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

interface LiveLeaderboardStateShape {
  entries: LeaderboardEntry[];
  lastUpdated?: number;
}

export default function LiveLeaderboardPage({ page }: LiveLeaderboardPageProps) {
  const rawConfig = (page.config as { config?: LiveLeaderboardConfig } | LiveLeaderboardConfig | null) ?? null;
  const config: LiveLeaderboardConfig =
    (rawConfig && "config" in rawConfig ? rawConfig.config : (rawConfig as LiveLeaderboardConfig | null)) ?? {};

  // 玩家 myId — 用 sessionStorage 隨機 id（簡化版；正式應接 useAuth）
  const myId = (() => {
    if (typeof window === "undefined") return "anon";
    const key = "leaderboard_my_id";
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `p_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  })();

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: LiveLeaderboardStateShape | null,
    ): LiveLeaderboardStateShape | null => {
      if (!config.acceptPlayerPulse) return null; // 預設拒絕（防作弊）
      const baseState: LiveLeaderboardStateShape = currentState ?? { entries: [] };
      const p = payload as { id?: string; name?: string; delta?: number; score?: number };
      if (!p?.id || !p?.name) return null;

      const newEntries = [...baseState.entries];
      const idx = newEntries.findIndex((e) => e.id === p.id);

      if (pulseType === "score_add") {
        const delta = p.delta ?? 0;
        if (idx >= 0) {
          newEntries[idx] = { ...newEntries[idx], score: newEntries[idx].score + delta };
        } else {
          newEntries.push({ id: p.id, name: p.name.slice(0, 20), score: delta });
        }
      } else if (pulseType === "score_set") {
        const score = p.score ?? 0;
        if (idx >= 0) {
          newEntries[idx] = { ...newEntries[idx], score, name: p.name.slice(0, 20) };
        } else {
          newEntries.push({ id: p.id, name: p.name.slice(0, 20), score });
        }
      } else {
        return null;
      }

      return {
        entries: newEntries,
        lastUpdated: Date.now(),
      };
    },
    [config.acceptPlayerPulse],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<LiveLeaderboardStateShape>({
    onPulse: handlePulse,
  });

  return (
    <LiveLeaderboard
      config={config}
      hostMode={hostMode}
      state={state}
      myId={myId}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
