import React from "react";

export interface CountdownChallengeConfig {
  title: string;
  challenge: string;
  durationSeconds: number;
  successLabel: string;
  failLabel: string;
  showLeaderboard: boolean;
}

export interface ChallengeEntry {
  userId: string;
  userName: string;
  completed: boolean;
  completedAt?: number;
}

export interface CountdownChallengeState extends Record<string, unknown> {
  startedAt: number | null;
  entries: ChallengeEntry[];
}

interface Props {
  config: CountdownChallengeConfig;
  state: CountdownChallengeState;
  myUserId: string;
  nowMs: number;
  onStart: () => void;
  onComplete: () => void;
  onFail: () => void;
}

function formatTime(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min > 0) return `${min}:${String(sec).padStart(2, "0")}`;
  return `${sec}`;
}

export default function CountdownChallenge({
  config,
  state,
  myUserId,
  nowMs,
  onStart,
  onComplete,
  onFail,
}: Props) {
  const { title, challenge, durationSeconds, successLabel, failLabel, showLeaderboard } = config;
  const { startedAt, entries } = state;

  const myEntry = entries.find((e) => e.userId === myUserId);
  const hasStarted = startedAt !== null;
  const elapsedMs = hasStarted ? nowMs - (startedAt ?? 0) : 0;
  const remainingMs = Math.max(0, durationSeconds * 1000 - elapsedMs);
  const isExpired = hasStarted && remainingMs <= 0;
  const isActive = hasStarted && !isExpired;

  const completedEntries = entries
    .filter((e) => e.completed && e.completedAt !== undefined)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0));

  const failedEntries = entries.filter((e) => !e.completed);

  const pct = hasStarted ? Math.max(0, (remainingMs / (durationSeconds * 1000)) * 100) : 100;

  return (
    <div data-testid="cc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="cc-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div data-testid="cc-challenge" className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
        <p className="text-base font-medium text-amber-800">{challenge}</p>
      </div>

      {/* Timer */}
      <div className="flex flex-col items-center gap-2">
        <div
          data-testid="cc-timer"
          className={[
            "text-5xl font-mono font-bold",
            !hasStarted
              ? "text-gray-400"
              : remainingMs <= 10000
              ? "text-red-500"
              : "text-amber-600",
          ].join(" ")}
        >
          {hasStarted ? formatTime(remainingMs) : formatTime(durationSeconds * 1000)}
        </div>
        <div className="w-full h-3 rounded-full bg-gray-100 overflow-hidden">
          <div
            data-testid="cc-timer-bar"
            className={[
              "h-full rounded-full transition-all",
              pct > 50 ? "bg-green-500" : pct > 20 ? "bg-amber-500" : "bg-red-500",
            ].join(" ")}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      {!hasStarted && (
        <button
          data-testid="cc-start-btn"
          onClick={onStart}
          className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          開始計時
        </button>
      )}

      {isActive && !myEntry && (
        <div className="flex gap-3">
          <button
            data-testid="cc-complete-btn"
            onClick={onComplete}
            className="flex-1 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
          >
            ✅ {successLabel}
          </button>
          <button
            data-testid="cc-fail-btn"
            onClick={onFail}
            className="flex-1 py-3 rounded-lg bg-red-400 hover:bg-red-500 text-white font-semibold transition-colors"
          >
            ❌ {failLabel}
          </button>
        </div>
      )}

      {isExpired && !myEntry && (
        <p data-testid="cc-expired-msg" className="text-center text-red-500 font-semibold">
          ⏰ 時間到！
        </p>
      )}

      {myEntry && (
        <p
          data-testid="cc-my-result"
          className={`text-center font-semibold ${myEntry.completed ? "text-green-600" : "text-red-500"}`}
        >
          {myEntry.completed ? `✅ ${successLabel}` : `❌ ${failLabel}`}
        </p>
      )}

      {/* Leaderboard */}
      {showLeaderboard && entries.length > 0 && (
        <div data-testid="cc-leaderboard" className="flex flex-col gap-2 mt-2">
          <h3 className="text-sm font-semibold text-gray-600">
            完成（{completedEntries.length}）
          </h3>
          {completedEntries.map((e, i) => (
            <div
              key={e.userId}
              data-testid={`cc-entry-${e.userId}`}
              className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {i + 1}. {e.userName}
              </span>
              {e.completedAt !== undefined && startedAt !== null && (
                <span
                  data-testid={`cc-time-${e.userId}`}
                  className="text-xs text-gray-500"
                >
                  {((e.completedAt - startedAt) / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          ))}
          {failedEntries.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-gray-600">
                未完成（{failedEntries.length}）
              </h3>
              {failedEntries.map((e) => (
                <div
                  key={e.userId}
                  data-testid={`cc-fail-entry-${e.userId}`}
                  className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-gray-600"
                >
                  {e.userName}
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {!hasStarted && entries.length === 0 && (
        <p data-testid="cc-waiting" className="text-center text-gray-400 text-sm">
          等待開始計時…
        </p>
      )}
    </div>
  );
}
