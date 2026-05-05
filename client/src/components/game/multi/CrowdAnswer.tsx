import { useState } from "react";

export interface CrowdGuess extends Record<string, unknown> {
  guessId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface CrowdAnswerConfig extends Record<string, unknown> {
  title: string;
  question: string;
  unit: string;
  correctAnswer: number;
}

export interface CrowdAnswerState extends Record<string, unknown> {
  guesses: CrowdGuess[];
  revealed: boolean;
}

const DEFAULT_CONFIG: CrowdAnswerConfig = {
  title: "猜猜看",
  question: "你的答案是？",
  unit: "",
  correctAnswer: 0,
};

interface Props {
  config: CrowdAnswerConfig;
  state: CrowdAnswerState;
  myUserId: string;
  onSubmit: (value: number) => void;
  onReveal: () => void;
}

export default function CrowdAnswer({
  config,
  state,
  myUserId,
  onSubmit,
  onReveal,
}: Props) {
  const [inputVal, setInputVal] = useState("");

  const { guesses, revealed } = state;
  const myGuess = guesses.find((g) => g.userId === myUserId);
  const title = config.title || DEFAULT_CONFIG.title;
  const question = config.question || DEFAULT_CONFIG.question;
  const unit = config.unit ?? "";
  const correctAnswer = config.correctAnswer ?? 0;

  const sortedByCloseness = revealed
    ? [...guesses].sort(
        (a, b) =>
          Math.abs(a.value - correctAnswer) - Math.abs(b.value - correctAnswer)
      )
    : [];

  const winner = sortedByCloseness[0];

  function handleSubmit() {
    const num = parseFloat(inputVal);
    if (isNaN(num)) return;
    onSubmit(num);
    setInputVal("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="ca-title"
        className="text-xl font-bold text-center"
      >
        {title}
      </h2>
      <p
        data-testid="ca-question"
        className="text-base text-center p-4 bg-violet-50 rounded-xl font-medium"
      >
        {question}
      </p>

      {!revealed && (
        <div className="space-y-3">
          {!myGuess ? (
            <div className="flex gap-2">
              <input
                data-testid="ca-input"
                type="number"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="輸入數字..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300"
              />
              {unit && (
                <span className="flex items-center text-sm text-gray-500 px-2">
                  {unit}
                </span>
              )}
              <button
                data-testid="ca-submit-btn"
                onClick={handleSubmit}
                disabled={inputVal.trim() === ""}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-semibold hover:bg-violet-700 disabled:opacity-40"
              >
                提交
              </button>
            </div>
          ) : (
            <p
              data-testid="ca-my-guess"
              className="text-center text-sm text-gray-500"
            >
              ✅ 已提交：{myGuess.value}
              {unit}
            </p>
          )}
          <p className="text-xs text-center text-gray-400">
            已有 {guesses.length} 人提交
          </p>
          <div className="text-center">
            <button
              data-testid="ca-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布答案
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div className="space-y-3">
          <div
            data-testid="ca-correct-answer"
            className="text-center p-3 bg-green-50 border-2 border-green-400 rounded-xl"
          >
            <p className="text-xs text-green-600 mb-1">正確答案</p>
            <p className="text-2xl font-bold text-green-800">
              {correctAnswer}
              {unit}
            </p>
          </div>

          {winner && (
            <p
              data-testid="ca-winner"
              className="text-center text-sm font-semibold text-yellow-700"
            >
              🏆 最接近：{winner.userName}（{winner.value}
              {unit}）
            </p>
          )}

          {sortedByCloseness.length === 0 ? (
            <div
              data-testid="ca-empty"
              className="text-center text-gray-400 py-8"
            >
              尚無人提交
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-center text-xs text-gray-400">猜測結果（由近到遠）</p>
              {sortedByCloseness.map((g, rank) => {
                const diff = Math.abs(g.value - correctAnswer);
                return (
                  <div
                    key={g.guessId}
                    data-testid={`ca-guess-${g.userId}`}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      rank === 0
                        ? "border-yellow-400 bg-yellow-50"
                        : g.userId === myUserId
                        ? "border-violet-200 bg-violet-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="text-sm">
                      {rank === 0 && "🏆 "}
                      {g.userName}
                      {g.userId === myUserId && " （我）"}
                    </span>
                    <span className="text-sm font-medium">
                      {g.value}
                      {unit}
                      <span className="text-xs text-gray-400 ml-1">
                        (差 {diff})
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
