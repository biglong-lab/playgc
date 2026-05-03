// ⚔️ TeamBattleScore — HostScreen 紅藍對抗即時計分元件
//
// 設計：依 host-screen-components.md 未來擴充候選 #1（多市場通用）
// pageType: host_team_battle_score
//
// 玩法：
//   - 大螢幕：左右分屏紅藍對抗 + 大數字 + 進度條（target mode）
//   - 玩家：可送 score pulse（依 acceptPlayerPulse 決定是否接受）
//   - admin：可送 reset / finish pulse
//   - 適用：企業團建（紅藍對抗）/ 婚禮男女組 / 班級對抗 / 派對遊戲 / 商圈集點對戰
//
// state 結構：
//   {
//     scores: Record<teamId, number>;
//     recentEvents: { id, teamId, points, ts, scoredBy? }[];
//     winner: string | null;
//     status: "playing" | "finished";
//   }
//
// pulse:
//   - type: "score"   payload: { teamId, points, scoredBy? }
//   - type: "reset"   payload: {}
//   - type: "finish"  payload: {}（admin 強制結束、highest mode 用）

import { useMemo } from "react";

export interface BattleTeam {
  id: string;
  name: string;
  color: string;
  emoji?: string;
}

export interface TeamBattleScoreConfig {
  title?: string;
  subtitle?: string;
  teams?: BattleTeam[];
  /** 目標分數（first_to_target 模式達標後鎖 winner） */
  targetScore?: number;
  /** 規則模式：first_to_target / highest / free */
  mode?: "first_to_target" | "highest" | "free";
  /** 是否顯示最近得分事件（預設 true） */
  showRecentEvents?: boolean;
  /** 是否接受玩家 pulse（預設 false 防作弊） */
  acceptPlayerPulse?: boolean;
}

export interface ScoreEvent {
  id: string;
  teamId: string;
  points: number;
  ts: number;
  scoredBy?: string;
}

export interface TeamBattleScoreState {
  scores: Record<string, number>;
  recentEvents: ScoreEvent[];
  winner: string | null;
  status: "playing" | "finished";
}

export const DEFAULT_BATTLE_TEAMS: BattleTeam[] = [
  { id: "red", name: "紅隊", color: "#ef4444", emoji: "🔴" },
  { id: "blue", name: "藍隊", color: "#3b82f6", emoji: "🔵" },
];

const MAX_RECENT_EVENTS = 20;

// ============================================================================
// 純函式 reducer（測試友好、host page 直接調用）
// ============================================================================

export function buildInitialBattleState(config: TeamBattleScoreConfig): TeamBattleScoreState {
  const teams = config.teams ?? DEFAULT_BATTLE_TEAMS;
  const scores: Record<string, number> = {};
  for (const t of teams) {
    scores[t.id] = 0;
  }
  return {
    scores,
    recentEvents: [],
    winner: null,
    status: "playing",
  };
}

export function reduceScore(
  state: TeamBattleScoreState,
  pulse: { teamId: string; points: number; scoredBy?: string },
  config: TeamBattleScoreConfig,
): TeamBattleScoreState {
  if (state.status === "finished") return state;
  if (!(pulse.teamId in state.scores)) return state;
  if (pulse.points <= 0) return state;

  const newScores = {
    ...state.scores,
    [pulse.teamId]: state.scores[pulse.teamId] + pulse.points,
  };

  const newEvent: ScoreEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    teamId: pulse.teamId,
    points: pulse.points,
    ts: Date.now(),
    scoredBy: pulse.scoredBy,
  };

  const newRecentEvents = [newEvent, ...state.recentEvents].slice(0, MAX_RECENT_EVENTS);

  let winner = state.winner;
  let status: "playing" | "finished" = state.status;
  const mode = config.mode ?? "first_to_target";
  if (mode === "first_to_target" && config.targetScore && newScores[pulse.teamId] >= config.targetScore) {
    winner = pulse.teamId;
    status = "finished";
  }

  return {
    scores: newScores,
    recentEvents: newRecentEvents,
    winner,
    status,
  };
}

export function reduceReset(config: TeamBattleScoreConfig): TeamBattleScoreState {
  return buildInitialBattleState(config);
}

export function reduceFinish(state: TeamBattleScoreState): TeamBattleScoreState {
  if (state.status === "finished") return state;
  let maxScore = -1;
  let winner: string | null = null;
  for (const [teamId, score] of Object.entries(state.scores)) {
    if (score > maxScore) {
      maxScore = score;
      winner = teamId;
    }
  }
  return { ...state, winner, status: "finished" };
}

// ============================================================================
// UI 元件
// ============================================================================

export interface TeamBattleScoreProps {
  config: TeamBattleScoreConfig;
  hostMode: boolean;
  state?: TeamBattleScoreState | null;
  onPulse?: (pulseType: string, payload: { teamId?: string; points?: number; scoredBy?: string }) => void;
  onBroadcastState?: (state: TeamBattleScoreState) => void;
}

export default function TeamBattleScore({ config, hostMode, state, onPulse }: TeamBattleScoreProps) {
  const teams = useMemo(() => config.teams ?? DEFAULT_BATTLE_TEAMS, [config.teams]);
  const effectiveState = useMemo(() => state ?? buildInitialBattleState(config), [state, config]);

  const showEvents = config.showRecentEvents !== false;

  return (
    <div className="flex flex-col h-screen w-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* 頂部標題 */}
      <div className="text-center py-4 px-6 border-b border-slate-700">
        <h1 className="text-3xl md:text-5xl font-bold">{config.title ?? "對抗賽"}</h1>
        {config.subtitle && (
          <p className="text-base md:text-xl text-slate-300 mt-1">{config.subtitle}</p>
        )}
        {config.targetScore && config.mode !== "highest" && config.mode !== "free" && (
          <p className="text-sm text-slate-400 mt-1">先達 {config.targetScore} 分獲勝</p>
        )}
      </div>

      {/* 隊伍分屏 — 動態 grid 依隊伍數 */}
      <div
        className={`flex-1 grid gap-2 p-2`}
        style={{ gridTemplateColumns: `repeat(${teams.length}, 1fr)` }}
        data-testid="team-battle-teams"
      >
        {teams.map((team) => {
          const score = effectiveState.scores[team.id] ?? 0;
          const progress = config.targetScore ? Math.min(100, (score / config.targetScore) * 100) : 0;
          const isWinner = effectiveState.winner === team.id;

          return (
            <div
              key={team.id}
              data-testid={`team-card-${team.id}`}
              className={`flex flex-col items-center justify-center rounded-2xl p-6 transition-all ${
                isWinner ? "ring-4 ring-yellow-400 scale-105" : ""
              }`}
              style={{ backgroundColor: `${team.color}33` }}
            >
              <div className="text-6xl mb-2">{team.emoji ?? "🏁"}</div>
              <div
                className="text-2xl md:text-4xl font-bold mb-2"
                style={{ color: team.color }}
              >
                {team.name}
              </div>
              <div
                className="text-7xl md:text-9xl font-black mb-3"
                style={{ color: team.color }}
                data-testid={`team-score-${team.id}`}
              >
                {score}
              </div>
              {config.targetScore && config.mode !== "free" && (
                <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div
                    className="h-full transition-all duration-500"
                    style={{ width: `${progress}%`, backgroundColor: team.color }}
                  />
                </div>
              )}
              {isWinner && (
                <div className="mt-3 text-2xl md:text-3xl font-bold text-yellow-300 animate-pulse">
                  🏆 勝出！
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 最近得分事件流（可選） */}
      {showEvents && effectiveState.recentEvents.length > 0 && (
        <div className="border-t border-slate-700 p-3 max-h-32 overflow-y-auto" data-testid="recent-events">
          <div className="text-xs text-slate-400 mb-1">最近得分</div>
          <div className="flex flex-wrap gap-2 text-sm">
            {effectiveState.recentEvents.slice(0, 8).map((evt) => {
              const team = teams.find((t) => t.id === evt.teamId);
              return (
                <span
                  key={evt.id}
                  className="px-2 py-1 rounded"
                  style={{ backgroundColor: `${team?.color ?? "#888"}44` }}
                >
                  {team?.emoji} {team?.name} +{evt.points}
                  {evt.scoredBy ? ` (${evt.scoredBy})` : ""}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* 玩家端：可選擇隊伍加分（acceptPlayerPulse=true 才顯示） */}
      {!hostMode && config.acceptPlayerPulse && effectiveState.status === "playing" && (
        <div className="p-4 border-t border-slate-700">
          <div className="text-sm text-slate-400 mb-2 text-center">為你的隊伍加分</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${teams.length}, 1fr)` }}>
            {teams.map((team) => (
              <button
                key={team.id}
                data-testid={`player-score-btn-${team.id}`}
                onClick={() => onPulse?.("score", { teamId: team.id, points: 1 })}
                className="px-4 py-3 rounded-lg text-white font-bold"
                style={{ backgroundColor: team.color }}
              >
                {team.emoji} +1 {team.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
