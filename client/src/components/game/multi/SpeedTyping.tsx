import { useState } from "react";

export interface TypingResult extends Record<string, unknown> {
  resultId: string;
  userId: string;
  userName: string;
  seconds: number;
  accuracy: number;
}

export interface SpeedTypingConfig extends Record<string, unknown> {
  title: string;
  phrase: string;
  maxSeconds: number;
}

export interface SpeedTypingState extends Record<string, unknown> {
  results: TypingResult[];
  revealed: boolean;
}

const DEFAULT_CONFIG: SpeedTypingConfig = {
  title: "競速打字",
  phrase: "請輸入這段文字",
  maxSeconds: 60,
};

interface Props {
  config: SpeedTypingConfig;
  state: SpeedTypingState;
  myUserId: string;
  now: number;
  onSubmit: (seconds: number, accuracy: number) => void;
  onReveal: () => void;
}

export default function SpeedTyping({
  config,
  state,
  myUserId,
  now,
  onSubmit,
  onReveal,
}: Props) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [finished, setFinished] = useState(false);

  const { title, phrase, maxSeconds } = config || DEFAULT_CONFIG;
  const { results, revealed } = state;

  const myResult = results.find((r) => r.userId === myUserId);
  const elapsed = startedAt !== null ? Math.floor((now - startedAt) / 1000) : 0;
  const timeLeft = Math.max(0, maxSeconds - elapsed);
  const isTimedOut = startedAt !== null && timeLeft === 0 && !finished;

  const sortedResults = [...results].sort((a, b) => a.seconds - b.seconds);

  function calcAccuracy(input: string): number {
    if (phrase.length === 0) return 100;
    let correct = 0;
    for (let i = 0; i < Math.min(input.length, phrase.length); i++) {
      if (input[i] === phrase[i]) correct++;
    }
    return Math.round((correct / phrase.length) * 100);
  }

  function handleStart() {
    setStartedAt(now);
    setTyped("");
    setFinished(false);
  }

  function handleFinish() {
    if (!startedAt) return;
    const secs = Math.floor((now - startedAt) / 1000);
    const acc = calcAccuracy(typed);
    setFinished(true);
    onSubmit(secs, acc);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="st-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div
        data-testid="st-phrase"
        className="p-4 bg-gray-50 rounded-xl border border-gray-200 text-sm font-mono text-gray-800 select-none"
      >
        {phrase}
      </div>

      {!revealed && (
        <div className="space-y-3">
          {!myResult && !finished ? (
            <>
              {startedAt === null ? (
                <div className="text-center">
                  <button
                    data-testid="st-start-btn"
                    onClick={handleStart}
                    className="px-8 py-3 bg-green-500 text-white rounded-xl text-sm font-bold hover:bg-green-600"
                  >
                    開始計時 ▶
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">已輸入 {typed.length} 字</span>
                    <span
                      data-testid="st-timer"
                      className={`text-sm font-bold ${timeLeft <= 10 ? "text-red-500" : "text-gray-700"}`}
                    >
                      ⏱ {timeLeft}s
                    </span>
                  </div>
                  <textarea
                    data-testid="st-input"
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    disabled={isTimedOut}
                    placeholder="在這裡輸入上方文字..."
                    rows={3}
                    className="w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                  />
                  <button
                    data-testid="st-submit-btn"
                    onClick={handleFinish}
                    disabled={isTimedOut || typed.trim().length === 0}
                    className="w-full py-2 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 disabled:opacity-40"
                  >
                    完成送出
                  </button>
                  {isTimedOut && (
                    <p className="text-xs text-red-500 text-center">時間到！</p>
                  )}
                </div>
              )}
            </>
          ) : (
            <p data-testid="st-my-result" className="text-center text-sm text-gray-500">
              ✅ 已完成：{myResult?.seconds ?? elapsed}秒，準確率 {myResult?.accuracy ?? 0}%
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="st-count">{results.length}</span> 人完成
          </p>

          <div className="text-center">
            <button
              data-testid="st-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布排行榜
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="st-result" className="space-y-2">
          {results.length === 0 ? (
            <div data-testid="st-empty" className="text-center text-gray-400 py-8">
              尚無人完成
            </div>
          ) : (
            sortedResults.map((r, idx) => (
              <div
                key={r.resultId}
                data-testid={`st-result-${r.userId}`}
                className="flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl"
              >
                <span className="text-lg font-bold text-gray-400 w-6 text-center">
                  {idx === 0 ? "🏆" : `${idx + 1}`}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">{r.userName}</p>
                  <p className="text-xs text-gray-500">準確率 {r.accuracy}%</p>
                </div>
                <span className="text-sm font-bold text-green-600">{r.seconds}秒</span>
              </div>
            ))
          )}
          {results.length > 0 && (
            <p data-testid="st-winner" className="text-center text-xs font-semibold text-amber-600">
              最快：{sortedResults[0].userName}（{sortedResults[0].seconds}秒）
            </p>
          )}
        </div>
      )}
    </div>
  );
}
