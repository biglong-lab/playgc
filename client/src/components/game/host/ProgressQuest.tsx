// 🚀 ProgressQuest — HostScreen 全場進度條元件（W18 D2）
//
// 設計依據：docs/decisions/0013-w18-component-expansion.md
// pageType: host_progress_quest
//
// 玩法：
//   - 大螢幕：大進度條 0% → 100%、達 25/50/75/100% 慶祝動畫
//   - 玩家端：點「我完成一個任務」推進度、看自己貢獻 + 全場狀態
//   - 適用：街區走讀、商圈打卡、企業內訓 KPI、員工旅遊里程碑、團體任務
//
// state 結構：
//   {
//     completed: number;             // 全場累計完成
//     totalTasks: number;            // 總任務數
//     contributors: Record<userId, number>; // 各玩家貢獻
//     milestonesReached: number[];   // 已達成里程碑（[25, 50, 75, 100]）
//   }
//
// pulse 結構：
//   { type: "complete", payload: { userId } }   // 玩家完成一個任務

import { useEffect, useState } from "react";

const DEFAULT_MILESTONES = [25, 50, 75, 100];
const DEFAULT_TOTAL_TASKS = 100;

export interface ProgressQuestConfig {
  title?: string;
  subtitle?: string;
  /** 總任務數（預設 100）*/
  totalTasks?: number;
  /** 里程碑百分比（預設 25/50/75/100）*/
  milestones?: number[];
  /** 達成里程碑時的慶祝級別（auto / fireworks / sticker） */
  celebrationLevel?: "auto" | "fireworks" | "sticker";
}

export interface ProgressQuestState {
  completed: number;
  totalTasks: number;
  contributors: Record<string, number>;
  milestonesReached: number[];
}

export interface ProgressQuestProps {
  config: ProgressQuestConfig;
  hostMode: boolean;
  state?: ProgressQuestState | null;
  onPulse?: (pulseType: string, payload: { userId: string }) => void;
  onBroadcastState?: (state: ProgressQuestState) => void;
}

export function buildInitialProgressState(config: ProgressQuestConfig): ProgressQuestState {
  return {
    completed: 0,
    totalTasks: config.totalTasks ?? DEFAULT_TOTAL_TASKS,
    contributors: {},
    milestonesReached: [],
  };
}

/**
 * 根據完成數計算進度百分比（0-100）
 * 純函式、易測試
 */
export function calculateProgress(completed: number, totalTasks: number): number {
  if (totalTasks <= 0) return 0;
  return Math.min(100, Math.round((completed / totalTasks) * 100));
}

/**
 * 偵測本次推進新達成的里程碑
 * 純函式、易測試
 */
export function detectNewMilestones(
  prevPercent: number,
  newPercent: number,
  milestones: number[],
): number[] {
  return milestones.filter((m) => prevPercent < m && newPercent >= m);
}

export default function ProgressQuest({ config, hostMode, state, onPulse }: ProgressQuestProps) {
  const milestones = config.milestones ?? DEFAULT_MILESTONES;
  const effectiveState = state ?? buildInitialProgressState(config);
  const percent = calculateProgress(effectiveState.completed, effectiveState.totalTasks);

  // hostMode：偵測里程碑慶祝動畫
  const [celebratingMilestone, setCelebratingMilestone] = useState<number | null>(null);
  useEffect(() => {
    if (!hostMode) return;
    const lastMilestone = effectiveState.milestonesReached[effectiveState.milestonesReached.length - 1];
    if (!lastMilestone) return;
    setCelebratingMilestone(lastMilestone);
    const timer = setTimeout(() => setCelebratingMilestone(null), 3500);
    return () => clearTimeout(timer);
  }, [hostMode, effectiveState.milestonesReached]);

  const contributorsList = Object.entries(effectiveState.contributors)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // ─── 大螢幕版型 ───
  if (hostMode) {
    return (
      <div className="w-full h-full min-h-screen relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-100 text-zinc-900">
        {/* 慶祝動畫覆蓋層 */}
        {celebratingMilestone !== null && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/20 backdrop-blur-sm"
            data-testid="celebration-overlay"
          >
            <div className="text-center animate-pulse">
              <div className="text-9xl mb-4">{celebratingMilestone === 100 ? "🏆" : "🎉"}</div>
              <div className="text-6xl font-bold text-amber-600">
                {celebratingMilestone}% 達成！
              </div>
              {celebratingMilestone === 100 && (
                <div className="text-4xl text-emerald-700 mt-3">完美達標 🎊</div>
              )}
            </div>
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center justify-center h-screen px-8">
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold text-center mb-2">
            🚀 {config.title ?? "全場進度"}
          </h1>
          {config.subtitle && (
            <p className="text-base md:text-xl text-zinc-600 text-center mb-8">
              {config.subtitle}
            </p>
          )}

          {/* 大進度條 */}
          <div className="w-full max-w-4xl mb-6">
            <div
              className="w-full h-16 md:h-24 bg-zinc-200 rounded-full overflow-hidden shadow-inner border-4 border-emerald-700"
              data-testid="progress-bar"
            >
              <div
                className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 transition-all duration-500 ease-out flex items-center justify-end pr-4"
                style={{ width: `${percent}%` }}
              >
                {percent >= 10 && (
                  <span className="text-white font-bold text-2xl md:text-3xl drop-shadow">
                    {percent}%
                  </span>
                )}
              </div>
              {percent < 10 && (
                <div className="text-zinc-500 text-2xl text-center -mt-16 md:-mt-20 leading-tight">
                  {percent}%
                </div>
              )}
            </div>

            {/* 里程碑刻度 */}
            <div className="relative w-full mt-2 px-2">
              {milestones.map((m) => (
                <div
                  key={m}
                  className={`absolute text-sm font-medium ${
                    percent >= m ? "text-emerald-700" : "text-zinc-400"
                  }`}
                  style={{ left: `${m}%`, transform: "translateX(-50%)" }}
                >
                  {percent >= m ? "✅" : "⚪"} {m}%
                </div>
              ))}
            </div>
          </div>

          {/* 計數 */}
          <div className="grid grid-cols-2 gap-8 mt-12 mb-8 text-center">
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <div className="text-5xl font-bold text-emerald-700">
                {effectiveState.completed}
              </div>
              <div className="text-base text-zinc-600 mt-1">已完成任務</div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-md">
              <div className="text-5xl font-bold text-teal-600">
                {effectiveState.totalTasks - effectiveState.completed}
              </div>
              <div className="text-base text-zinc-600 mt-1">剩餘任務</div>
            </div>
          </div>

          {/* 貢獻榜 top 5 */}
          {contributorsList.length > 0 && (
            <div className="bg-white rounded-2xl p-4 shadow-md max-w-md w-full">
              <div className="text-sm text-zinc-500 mb-2">⭐ 貢獻榜</div>
              <div className="space-y-1">
                {contributorsList.map(([userId, count], idx) => (
                  <div key={userId} className="flex justify-between items-center text-sm">
                    <span>
                      {idx === 0 && "🥇 "}
                      {idx === 1 && "🥈 "}
                      {idx === 2 && "🥉 "}
                      {idx > 2 && `#${idx + 1} `}
                      {userId}
                    </span>
                    <span className="font-bold text-emerald-600">×{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── 玩家版型 ───
  const playerName =
    (typeof window !== "undefined" && localStorage.getItem("chitoUserName")) || "";
  const myContribution = playerName ? effectiveState.contributors[playerName] ?? 0 : 0;

  return (
    <div className="w-full p-4 max-w-md mx-auto space-y-4">
      <div className="text-center space-y-2">
        <h2 className="text-xl font-bold">🚀 {config.title ?? "全場進度"}</h2>
        {config.subtitle && (
          <p className="text-sm text-muted-foreground">{config.subtitle}</p>
        )}
      </div>

      {/* 全場進度 */}
      <div className="bg-card rounded-xl p-4 border-2 border-border">
        <div className="text-xs text-muted-foreground mb-2">全場進度</div>
        <div className="w-full h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
            style={{ width: `${percent}%` }}
            data-testid="player-progress-fill"
          />
        </div>
        <div className="text-center mt-2 text-2xl font-bold text-emerald-600">
          {percent}%
        </div>
        <div className="text-center text-xs text-muted-foreground">
          {effectiveState.completed} / {effectiveState.totalTasks} 任務
        </div>
      </div>

      {/* 我的貢獻 */}
      <div className="bg-emerald-50 dark:bg-emerald-950 rounded-xl p-4 text-center">
        <div className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">我的貢獻</div>
        <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">
          {myContribution}
        </div>
        <div className="text-xs text-muted-foreground mt-1">已完成任務數</div>
      </div>

      {/* 推進按鈕 */}
      <button
        type="button"
        onClick={() => {
          if (!playerName) {
            alert("請先設定玩家名稱");
            return;
          }
          if (effectiveState.completed >= effectiveState.totalTasks) return;
          onPulse?.("complete", { userId: playerName });
        }}
        disabled={effectiveState.completed >= effectiveState.totalTasks}
        className="w-full py-4 bg-emerald-500 text-white rounded-xl font-bold text-lg shadow-md hover:bg-emerald-600 active:scale-95 transition-all disabled:bg-zinc-300 disabled:text-zinc-500"
        data-testid="btn-progress-complete"
      >
        {effectiveState.completed >= effectiveState.totalTasks
          ? "🎉 全場已完成！"
          : "✅ 我完成一個任務"}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        💡 達成 25 / 50 / 75 / 100% 大螢幕會慶祝
      </p>
    </div>
  );
}
