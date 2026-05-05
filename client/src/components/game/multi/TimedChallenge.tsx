export interface CompletionRecord extends Record<string, unknown> {
  completionId: string;
  userId: string;
  userName: string;
  completedAt: number;
}

export interface TimedChallengeConfig extends Record<string, unknown> {
  title: string;
  challengeText: string;
  durationSeconds: number;
}

export interface TimedChallengeState extends Record<string, unknown> {
  completions: CompletionRecord[];
  phase: "waiting" | "running" | "ended";
  startedAt: number | null;
}

const DEFAULT_CONFIG: TimedChallengeConfig = {
  title: "限時挑戰",
  challengeText: "完成任務後按下按鈕！",
  durationSeconds: 60,
};

interface Props {
  config: TimedChallengeConfig;
  state: TimedChallengeState;
  myUserId: string;
  now: number;
  onStart: () => void;
  onComplete: () => void;
  onEnd: () => void;
}

export default function TimedChallenge({
  config,
  state,
  myUserId,
  now,
  onStart,
  onComplete,
  onEnd,
}: Props) {
  const { completions, phase, startedAt } = state;
  const title = config.title || DEFAULT_CONFIG.title;
  const challengeText = config.challengeText || DEFAULT_CONFIG.challengeText;
  const durationSeconds = config.durationSeconds ?? DEFAULT_CONFIG.durationSeconds;

  const elapsed = phase === "running" && startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const remaining = Math.max(0, durationSeconds - elapsed);
  const progressPct = durationSeconds > 0 ? Math.min(100, (elapsed / durationSeconds) * 100) : 0;

  const myCompletion = completions.find((c) => c.userId === myUserId);
  const sortedCompletions = [...completions].sort(
    (a, b) => a.completedAt - b.completedAt
  );
  const winner = sortedCompletions[0];

  const phaseLabel =
    phase === "waiting" ? "準備中" : phase === "running" ? "挑戰進行中！" : "結束";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="tc-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p
        data-testid="tc-phase"
        className="text-center text-sm font-medium text-violet-600"
      >
        {phaseLabel}
      </p>
      <p
        data-testid="tc-challenge"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {challengeText}
      </p>

      {phase === "waiting" && (
        <div className="text-center">
          <p className="text-xs text-gray-400 mb-3">限時 {durationSeconds} 秒</p>
          <button
            data-testid="tc-start-btn"
            onClick={onStart}
            className="px-8 py-3 bg-violet-600 text-white rounded-xl font-bold text-lg hover:bg-violet-700"
          >
            開始挑戰
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-500">
              <span>進度</span>
              <span data-testid="tc-countdown" className="font-bold text-violet-700">
                {remaining}s
              </span>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                data-testid="tc-progress-bar"
                className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          {!myCompletion ? (
            <div className="text-center">
              <button
                data-testid="tc-complete-btn"
                onClick={onComplete}
                className="w-full py-6 text-3xl bg-green-500 text-white rounded-2xl font-bold shadow-lg hover:bg-green-600 active:scale-95 transition-transform"
              >
                ✅ 完成！
              </button>
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500">
              ✅ 已完成，排名第{" "}
              {sortedCompletions.findIndex((c) => c.userId === myUserId) + 1}
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            已有{" "}
            <span data-testid="tc-done-count">{completions.length}</span> 人完成
          </p>

          <div className="text-center">
            <button
              data-testid="tc-end-btn"
              onClick={onEnd}
              className="px-4 py-1 text-xs text-gray-400 border border-gray-200 rounded-lg hover:border-gray-300"
            >
              提前結束
            </button>
          </div>
        </div>
      )}

      {phase === "ended" && (
        <div className="space-y-3">
          {sortedCompletions.length === 0 ? (
            <div data-testid="tc-empty" className="text-center text-gray-400 py-8">
              尚無人完成挑戰
            </div>
          ) : (
            <>
              {winner && (
                <p
                  data-testid="tc-winner"
                  className="text-center text-sm font-semibold text-yellow-700"
                >
                  🏆 最快完成：{winner.userName}
                </p>
              )}
              <div className="space-y-2">
                <p className="text-xs text-center text-gray-400">完成排名</p>
                {sortedCompletions.map((c, rank) => {
                  const elapsed =
                    startedAt
                      ? ((c.completedAt - startedAt) / 1000).toFixed(1)
                      : "?";
                  return (
                    <div
                      key={c.completionId}
                      data-testid={`tc-result-${c.userId}`}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        rank === 0
                          ? "border-yellow-400 bg-yellow-50"
                          : c.userId === myUserId
                          ? "border-violet-200 bg-violet-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <span className="text-sm">
                        {rank === 0 && "🏆 "}#{rank + 1} {c.userName}
                        {c.userId === myUserId && " （我）"}
                      </span>
                      <span className="text-xs text-gray-500">{elapsed}s</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
