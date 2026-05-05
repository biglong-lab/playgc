import React from "react";

export interface GroupCheerConfig {
  title: string;
  goal: number;
  tapEmoji: string;
  celebrateMessage: string;
}

export interface GroupCheerState extends Record<string, unknown> {
  totalTaps: number;
  tapsByUser: Record<string, number>;
}

interface Props {
  config: GroupCheerConfig;
  state: GroupCheerState;
  myUserId: string;
  onTap: () => void;
}

export default function GroupCheer({ config, state, myUserId, onTap }: Props) {
  const { title, goal, tapEmoji, celebrateMessage } = config;
  const { totalTaps, tapsByUser } = state;

  const myTaps = tapsByUser[myUserId] ?? 0;
  const pct = Math.min(Math.round((totalTaps / goal) * 100), 100);
  const achieved = totalTaps >= goal;

  // 貢獻者排行（前 3）
  const topContributors = Object.entries(tapsByUser)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div data-testid="gc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto text-center">
      <h2 data-testid="gc-title" className="text-lg font-bold">{title}</h2>

      {/* 進度條 */}
      <div className="flex flex-col gap-1">
        <div className="flex justify-between text-xs text-gray-500">
          <span data-testid="gc-total">{totalTaps}</span>
          <span data-testid="gc-goal">目標 {goal}</span>
        </div>
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
          <div
            data-testid="gc-bar"
            className={[
              "h-full rounded-full transition-all duration-300",
              achieved ? "bg-yellow-400" : "bg-purple-500",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p data-testid="gc-pct" className="text-xs text-gray-400">{pct}%</p>
      </div>

      {/* 達成慶祝 */}
      {achieved ? (
        <div data-testid="gc-celebrate" className="py-4 flex flex-col gap-2">
          <div className="text-5xl animate-bounce">🎉</div>
          <p className="font-bold text-yellow-600 text-lg">{celebrateMessage}</p>
        </div>
      ) : (
        /* 點擊按鈕 */
        <button
          data-testid="gc-tap-btn"
          onClick={onTap}
          className="text-6xl py-6 rounded-2xl bg-purple-50 hover:bg-purple-100 active:scale-95 border-2 border-purple-200 hover:border-purple-400 transition-all select-none"
          aria-label="點擊應援"
        >
          {tapEmoji}
        </button>
      )}

      {/* 我的貢獻 */}
      <p className="text-sm text-gray-500">
        我已貢獻 <span data-testid="gc-my-taps" className="font-bold text-purple-600">{myTaps}</span> 次
      </p>

      {/* 貢獻排行 */}
      {topContributors.length > 0 && (
        <div data-testid="gc-leaderboard" className="flex flex-col gap-1 text-xs text-gray-400">
          <p className="font-semibold text-gray-500">貢獻排行</p>
          {topContributors.map(([userId, count], idx) => (
            <div key={userId} data-testid={`gc-rank-${userId}`} className="flex justify-between px-2">
              <span>{["🥇", "🥈", "🥉"][idx]} {userId}</span>
              <span data-testid={`gc-rank-count-${userId}`}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
