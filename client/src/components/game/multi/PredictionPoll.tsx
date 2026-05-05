import { useState } from "react";

export interface PollOption extends Record<string, unknown> {
  optionId: string;
  label: string;
}

export interface UserPrediction extends Record<string, unknown> {
  userId: string;
  userName: string;
  predictedOptionId: string;
}

export interface UserAnswer extends Record<string, unknown> {
  userId: string;
  answeredOptionId: string;
}

export interface PredictionPollConfig extends Record<string, unknown> {
  title: string;
  question: string;
  options: PollOption[];
}

export interface PredictionPollState extends Record<string, unknown> {
  predictions: UserPrediction[];
  answers: UserAnswer[];
  phase: "predict" | "answer" | "result";
}

const DEFAULT_OPTIONS: PollOption[] = [
  { optionId: "a", label: "選項 A" },
  { optionId: "b", label: "選項 B" },
  { optionId: "c", label: "選項 C" },
];

const DEFAULT_CONFIG: PredictionPollConfig = {
  title: "預測投票",
  question: "大家的選擇是什麼？",
  options: DEFAULT_OPTIONS,
};

interface Props {
  config: PredictionPollConfig;
  state: PredictionPollState;
  myUserId: string;
  onPredict: (optionId: string) => void;
  onAnswer: (optionId: string) => void;
  onAdvancePhase: () => void;
}

export default function PredictionPoll({
  config,
  state,
  myUserId,
  onPredict,
  onAnswer,
  onAdvancePhase,
}: Props) {
  const options =
    Array.isArray(config.options) && config.options.length > 0
      ? config.options
      : DEFAULT_OPTIONS;
  const { predictions, answers, phase } = state;

  const myPrediction = predictions.find((p) => p.userId === myUserId);
  const myAnswer = answers.find((a) => a.userId === myUserId);

  function getActualPercent(optionId: string): number {
    if (answers.length === 0) return 0;
    const count = answers.filter((a) => a.answeredOptionId === optionId).length;
    return Math.round((count / answers.length) * 100);
  }

  function getWinner(): PollOption | null {
    if (answers.length === 0) return null;
    let maxCount = 0;
    let winner: PollOption | null = null;
    for (const opt of options) {
      const count = answers.filter(
        (a) => a.answeredOptionId === opt.optionId
      ).length;
      if (count > maxCount) {
        maxCount = count;
        winner = opt;
      }
    }
    return winner;
  }

  const winner = getWinner();
  const predictedRight = winner
    ? predictions.filter((p) => p.predictedOptionId === winner!.optionId)
        .length
    : 0;

  const phaseLabel =
    phase === "predict" ? "預測" : phase === "answer" ? "作答" : "結果";
  const advanceBtnLabel =
    phase === "predict"
      ? "開始作答"
      : phase === "answer"
      ? "揭曉結果"
      : "";

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2
        data-testid="pp-title"
        className="text-xl font-bold text-center"
      >
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <div
        data-testid="pp-phase"
        className="text-sm text-center text-gray-500"
      >
        {phaseLabel}
      </div>
      <p
        data-testid="pp-question"
        className="text-center font-medium text-lg"
      >
        {config.question || DEFAULT_CONFIG.question}
      </p>

      {phase === "predict" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 text-center">
            你覺得哪個選項最多人選？
          </p>
          {options.map((opt) => (
            <button
              key={opt.optionId}
              data-testid={`pp-predict-${opt.optionId}`}
              onClick={() => onPredict(opt.optionId)}
              disabled={!!myPrediction}
              className={`w-full py-3 rounded-lg border-2 text-left px-4 transition-colors ${
                myPrediction?.predictedOptionId === opt.optionId
                  ? "border-blue-500 bg-blue-50 font-semibold"
                  : "border-gray-200 hover:border-blue-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {myPrediction && (
            <p
              data-testid="pp-predicted-msg"
              className="text-center text-sm text-green-600"
            >
              ✅ 已選擇預測：
              {options.find(
                (o) => o.optionId === myPrediction.predictedOptionId
              )?.label}
            </p>
          )}
          <p
            data-testid="pp-prediction-count"
            className="text-xs text-center text-gray-400"
          >
            已預測：{predictions.length} 人
          </p>
          <button
            data-testid="pp-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 mt-2"
          >
            {advanceBtnLabel}
          </button>
        </div>
      )}

      {phase === "answer" && (
        <div className="space-y-2">
          <p className="text-sm text-gray-600 text-center">
            現在輪到你真正作答！
          </p>
          {options.map((opt) => (
            <button
              key={opt.optionId}
              data-testid={`pp-answer-${opt.optionId}`}
              onClick={() => onAnswer(opt.optionId)}
              disabled={!!myAnswer}
              className={`w-full py-3 rounded-lg border-2 text-left px-4 transition-colors ${
                myAnswer?.answeredOptionId === opt.optionId
                  ? "border-green-500 bg-green-50 font-semibold"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              {opt.label}
            </button>
          ))}
          {myAnswer && (
            <p
              data-testid="pp-answered-msg"
              className="text-center text-sm text-green-600"
            >
              ✅ 已作答：
              {options.find(
                (o) => o.optionId === myAnswer.answeredOptionId
              )?.label}
            </p>
          )}
          <p
            data-testid="pp-answer-count"
            className="text-xs text-center text-gray-400"
          >
            已作答：{answers.length} 人
          </p>
          <button
            data-testid="pp-advance-btn"
            onClick={onAdvancePhase}
            className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 mt-2"
          >
            {advanceBtnLabel}
          </button>
        </div>
      )}

      {phase === "result" && (
        <div data-testid="pp-result" className="space-y-4">
          {answers.length === 0 ? (
            <div
              data-testid="pp-empty"
              className="text-center text-gray-400 py-8"
            >
              尚無作答資料
            </div>
          ) : (
            <>
              {winner && (
                <div
                  data-testid="pp-winner"
                  className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <span className="text-2xl">🏆</span>
                  <p className="font-bold text-yellow-800">
                    最多人選：{winner.label}
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {options.map((opt) => {
                  const pct = getActualPercent(opt.optionId);
                  return (
                    <div
                      key={opt.optionId}
                      data-testid={`pp-bar-${opt.optionId}`}
                    >
                      <div className="flex justify-between text-sm mb-1">
                        <span>{opt.label}</span>
                        <span>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-3">
                        <div
                          data-testid={`pp-bar-fill-${opt.optionId}`}
                          className="bg-green-500 h-3 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div
                data-testid="pp-accuracy"
                className="text-center p-3 bg-blue-50 rounded-lg"
              >
                <p className="text-sm text-blue-700">
                  🎯 猜對的人：{predictedRight} / {predictions.length}
                </p>
                {myPrediction && winner && (
                  <p
                    data-testid="pp-my-accuracy"
                    className="text-xs mt-1"
                  >
                    {myPrediction.predictedOptionId === winner.optionId
                      ? "✅ 你猜對了！"
                      : "❌ 你猜錯了"}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
