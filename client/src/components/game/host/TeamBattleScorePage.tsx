// ⚔️ TeamBattleScorePage — GamePageRenderer 對應 pageType="host_team_battle_score"

import { useCallback, useMemo } from "react";
import TeamBattleScore, {
  type TeamBattleScoreConfig,
  type TeamBattleScoreState,
  buildInitialBattleState,
  reduceScore,
  reduceReset,
  reduceFinish,
} from "./TeamBattleScore";
import { useHostScreenSyncWithPulse } from "../shared/hooks/useHostScreenSync";
import type { Page } from "@shared/schema";

interface TeamBattleScorePageProps {
  page: Page;
}

export default function TeamBattleScorePage({ page }: TeamBattleScorePageProps) {
  // 用 useMemo 穩定 config 物件 identity（防 useCallback dep 每次 render 失效）
  const config = useMemo<TeamBattleScoreConfig>(() => {
    const raw = (page.config as { config?: TeamBattleScoreConfig } | TeamBattleScoreConfig | null) ?? null;
    return (raw && "config" in raw ? raw.config : (raw as TeamBattleScoreConfig | null)) ?? {};
  }, [page.config]);

  const handlePulse = useCallback(
    (
      pulseType: string,
      payload: unknown,
      currentState: TeamBattleScoreState | null,
    ): TeamBattleScoreState | null => {
      const baseState = currentState ?? buildInitialBattleState(config);

      if (pulseType === "score") {
        const p = payload as { teamId?: string; points?: number; scoredBy?: string };
        if (!p.teamId || typeof p.points !== "number") return null;
        // 玩家端要求加分但 admin 設定不接受 → 忽略（防作弊）
        // host 端 broadcastState 不會走這裡、不影響 admin 控制
        if (config.acceptPlayerPulse === false) return null;
        return reduceScore(
          baseState,
          { teamId: p.teamId, points: p.points, scoredBy: p.scoredBy },
          config,
        );
      }

      if (pulseType === "reset") {
        return reduceReset(config);
      }

      if (pulseType === "finish") {
        return reduceFinish(baseState);
      }

      return null;
    },
    [config],
  );

  const { state, sendPulse, broadcastState, hostMode } = useHostScreenSyncWithPulse<TeamBattleScoreState>({
    onPulse: handlePulse,
  });

  return (
    <TeamBattleScore
      config={config}
      hostMode={hostMode}
      state={state}
      onPulse={sendPulse}
      onBroadcastState={broadcastState}
    />
  );
}
