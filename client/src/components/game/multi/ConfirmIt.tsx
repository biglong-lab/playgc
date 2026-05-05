import { useState } from "react";

export interface ConfirmResponse extends Record<string, unknown> {
  respId: string;
  userId: string;
  userName: string;
  answer: "true" | "false";
  confidence: number;
}

export interface ConfirmItConfig extends Record<string, unknown> {
  title: string;
  statement: string;
  showConfidence: boolean;
}

export interface ConfirmItState extends Record<string, unknown> {
  responses: ConfirmResponse[];
  revealed: boolean;
}

const CONFIDENCE_LEVELS = [50, 60, 70, 80, 90, 100];

const DEFAULT_CONFIG: ConfirmItConfig = {
  title: "信心投票",
  statement: "待確認的陳述",
  showConfidence: true,
};

interface Props {
  config: ConfirmItConfig;
  state: ConfirmItState;
  myUserId: string;
  onSubmit: (answer: "true" | "false", confidence: number) => void;
  onReveal: () => void;
}

export default function ConfirmIt({ config, state, myUserId, onSubmit, onReveal }: Props) {
  const [selectedAnswer, setSelectedAnswer] = useState<"true" | "false" | null>(null);
  const [confidence, setConfidence] = useState<number>(70);

  const { title, statement, showConfidence } = config || DEFAULT_CONFIG;
  const { responses, revealed } = state;

  const myResponse = responses.find((r) => r.userId === myUserId);
  const trueCount = responses.filter((r) => r.answer === "true").length;
  const falseCount = responses.filter((r) => r.answer === "false").length;
  const total = responses.length;

  const trueAvgConf =
    trueCount > 0
      ? Math.round(
          responses.filter((r) => r.answer === "true").reduce((s, r) => s + r.confidence, 0) /
            trueCount,
        )
      : 0;
  const falseAvgConf =
    falseCount > 0
      ? Math.round(
          responses.filter((r) => r.answer === "false").reduce((s, r) => s + r.confidence, 0) /
            falseCount,
        )
      : 0;

  function handleSubmit() {
    if (!selectedAnswer) return;
    onSubmit(selectedAnswer, confidence);
    setSelectedAnswer(null);
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="ci-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div
        data-testid="ci-statement"
        className="p-5 bg-indigo-50 rounded-xl border border-indigo-200 text-center text-base font-medium text-indigo-900"
      >
        {statement}
      </div>

      {!revealed && (
        <div className="space-y-4">
          {!myResponse ? (
            <div className="space-y-3">
              <div className="flex gap-3">
                <button
                  data-testid="ci-answer-true"
                  onClick={() => setSelectedAnswer("true")}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    selectedAnswer === "true"
                      ? "border-green-500 bg-green-50 text-green-700"
                      : "border-gray-200 text-gray-500 hover:border-green-200"
                  }`}
                >
                  ✅ 正確
                </button>
                <button
                  data-testid="ci-answer-false"
                  onClick={() => setSelectedAnswer("false")}
                  className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${
                    selectedAnswer === "false"
                      ? "border-red-500 bg-red-50 text-red-700"
                      : "border-gray-200 text-gray-500 hover:border-red-200"
                  }`}
                >
                  ❌ 錯誤
                </button>
              </div>

              {selectedAnswer && showConfidence && (
                <div className="space-y-2">
                  <p className="text-xs text-center text-gray-500">信心程度</p>
                  <div className="flex gap-1 justify-center">
                    {CONFIDENCE_LEVELS.map((lvl) => (
                      <button
                        key={lvl}
                        data-testid={`ci-conf-${lvl}`}
                        onClick={() => setConfidence(lvl)}
                        className={`px-2 py-1 rounded text-xs font-semibold border ${
                          confidence === lvl
                            ? "border-indigo-500 bg-indigo-100 text-indigo-700"
                            : "border-gray-200 text-gray-500 hover:border-indigo-200"
                        }`}
                      >
                        {lvl}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedAnswer && (
                <button
                  data-testid="ci-submit-btn"
                  onClick={handleSubmit}
                  className="w-full py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700"
                >
                  送出投票
                </button>
              )}
            </div>
          ) : (
            <p data-testid="ci-submitted" className="text-center text-sm text-gray-500">
              ✅ 已投票：{myResponse.answer === "true" ? "正確" : "錯誤"}
              {showConfidence ? `（信心 ${myResponse.confidence}%）` : ""}
            </p>
          )}

          <p className="text-xs text-center text-gray-400">
            已有 <span data-testid="ci-count">{total}</span> 人投票
          </p>

          <div className="text-center">
            <button
              data-testid="ci-reveal-btn"
              onClick={onReveal}
              className="px-6 py-2 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600"
            >
              公布結果
            </button>
          </div>
        </div>
      )}

      {revealed && (
        <div data-testid="ci-result" className="space-y-3">
          {total === 0 ? (
            <div data-testid="ci-empty" className="text-center text-gray-400 py-8">
              尚無人投票
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div
                  data-testid="ci-true-block"
                  className="p-3 bg-green-50 border border-green-200 rounded-xl text-center space-y-1"
                >
                  <p className="text-2xl">✅</p>
                  <p className="text-sm font-bold text-green-700">正確</p>
                  <p data-testid="ci-true-count" className="text-xl font-bold text-green-800">
                    {trueCount}
                  </p>
                  <p className="text-xs text-gray-500">
                    {total > 0 ? Math.round((trueCount / total) * 100) : 0}%
                  </p>
                  {showConfidence && trueCount > 0 && (
                    <p data-testid="ci-true-conf" className="text-xs text-green-600">
                      平均信心 {trueAvgConf}%
                    </p>
                  )}
                </div>
                <div
                  data-testid="ci-false-block"
                  className="p-3 bg-red-50 border border-red-200 rounded-xl text-center space-y-1"
                >
                  <p className="text-2xl">❌</p>
                  <p className="text-sm font-bold text-red-700">錯誤</p>
                  <p data-testid="ci-false-count" className="text-xl font-bold text-red-800">
                    {falseCount}
                  </p>
                  <p className="text-xs text-gray-500">
                    {total > 0 ? Math.round((falseCount / total) * 100) : 0}%
                  </p>
                  {showConfidence && falseCount > 0 && (
                    <p data-testid="ci-false-conf" className="text-xs text-red-600">
                      平均信心 {falseAvgConf}%
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                {responses.map((r) => (
                  <div
                    key={r.respId}
                    data-testid={`ci-resp-${r.respId}`}
                    className="flex items-center justify-between text-xs px-3 py-1 bg-gray-50 rounded-lg"
                  >
                    <span className="text-gray-700">{r.userName}</span>
                    <span className={r.answer === "true" ? "text-green-600" : "text-red-600"}>
                      {r.answer === "true" ? "✅" : "❌"}
                      {showConfidence ? ` ${r.confidence}%` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
