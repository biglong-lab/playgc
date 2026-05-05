import React from "react";

export interface ScaledFeedbackQuestion {
  id: string;
  text: string;
  minLabel?: string;
  maxLabel?: string;
}

export interface ScaledFeedbackConfig {
  title: string;
  instructions?: string;
  questions: ScaledFeedbackQuestion[];
  scale: 5 | 10;
  showResults: boolean;
}

export interface ScaledFeedbackResponse {
  userId: string;
  userName: string;
  ratings: Record<string, number>;
  submittedAt: number;
}

export interface ScaledFeedbackState extends Record<string, unknown> {
  responses: ScaledFeedbackResponse[];
}

interface Props {
  config: ScaledFeedbackConfig;
  state: ScaledFeedbackState;
  myUserId: string;
  localRatings: Record<string, number>;
  onRatingChange: (questionId: string, value: number) => void;
  onSubmit: () => void;
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export default function ScaledFeedback({
  config,
  state,
  myUserId,
  localRatings,
  onRatingChange,
  onSubmit,
}: Props) {
  const { title, instructions, questions, scale, showResults } = config;
  const { responses } = state;

  const myResponse = responses.find((r) => r.userId === myUserId);
  const isComplete = questions.every((q) => localRatings[q.id] !== undefined);

  const scaleOptions = Array.from({ length: scale }, (_, i) => i + 1);

  return (
    <div data-testid="sf-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="sf-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      {instructions && (
        <p data-testid="sf-instructions" className="text-sm text-gray-500 text-center">
          {instructions}
        </p>
      )}

      {!myResponse ? (
        <div className="flex flex-col gap-5">
          {questions.map((q) => (
            <div key={q.id} data-testid={`sf-question-${q.id}`} className="rounded-xl border p-4 flex flex-col gap-2">
              <p data-testid={`sf-text-${q.id}`} className="font-medium text-sm">
                {q.text}
              </p>
              <div className="flex justify-between text-xs text-gray-400">
                <span data-testid={`sf-min-label-${q.id}`}>{q.minLabel ?? "低"}</span>
                <span data-testid={`sf-max-label-${q.id}`}>{q.maxLabel ?? "高"}</span>
              </div>
              <div className="flex gap-2 justify-between">
                {scaleOptions.map((val) => (
                  <button
                    key={val}
                    data-testid={`sf-btn-${q.id}-${val}`}
                    onClick={() => onRatingChange(q.id, val)}
                    className={[
                      "flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all",
                      localRatings[q.id] === val
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-600",
                    ].join(" ")}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}

          {!isComplete && (
            <p data-testid="sf-incomplete-hint" className="text-xs text-amber-500 text-center">
              請為所有題目評分後再提交
            </p>
          )}

          <button
            data-testid="sf-submit-btn"
            disabled={!isComplete}
            onClick={onSubmit}
            className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            提交評分
          </button>
        </div>
      ) : (
        <div data-testid="sf-submitted-msg" className="text-center py-4 text-green-600 font-semibold">
          ✅ 已提交評分（共{" "}
          <span data-testid="sf-count">{responses.length}</span> 人）
        </div>
      )}

      {showResults && responses.length > 0 && (
        <div data-testid="sf-results" className="flex flex-col gap-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-600">
            群體結果（{responses.length} 人）
          </h3>
          {questions.map((q) => {
            const vals = responses
              .map((r) => r.ratings[q.id])
              .filter((v) => v !== undefined);
            const average = avg(vals);
            const dist: Record<number, number> = {};
            for (let i = 1; i <= scale; i++) dist[i] = 0;
            vals.forEach((v) => { dist[v] = (dist[v] ?? 0) + 1; });
            const maxCount = Math.max(...Object.values(dist), 1);

            return (
              <div key={q.id} data-testid={`sf-result-${q.id}`} className="rounded-xl border p-3 flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-medium text-gray-700">{q.text}</p>
                  <span
                    data-testid={`sf-avg-${q.id}`}
                    className="text-sm font-bold text-indigo-600 ml-2 shrink-0"
                  >
                    均 {average}
                  </span>
                </div>
                <div className="flex gap-1 items-end h-10">
                  {scaleOptions.map((val) => (
                    <div
                      key={val}
                      data-testid={`sf-bar-${q.id}-${val}`}
                      className="flex-1 bg-indigo-400 rounded-t transition-all"
                      style={{ height: `${(dist[val] / maxCount) * 100}%`, minHeight: dist[val] > 0 ? "4px" : "0" }}
                      title={`${val}: ${dist[val]} 人`}
                    />
                  ))}
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{q.minLabel ?? "低"}</span>
                  <span>{q.maxLabel ?? "高"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {responses.length === 0 && !myResponse && (
        <p data-testid="sf-empty" className="text-center text-gray-400 text-sm">
          等待大家填寫中…
        </p>
      )}
    </div>
  );
}
