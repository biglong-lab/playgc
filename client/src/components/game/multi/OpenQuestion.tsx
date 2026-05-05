import React from "react";

export interface OpenQuestionConfig {
  title: string;
  question: string;
  maxLength: number;
  maxAnswersPerPerson: number;
  showAuthor: boolean;
  placeholder?: string;
}

export interface OpenAnswer {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  submittedAt: number;
}

export interface OpenQuestionState extends Record<string, unknown> {
  answers: OpenAnswer[];
}

interface Props {
  config: OpenQuestionConfig;
  state: OpenQuestionState;
  myUserId: string;
  draftText: string;
  onDraftChange: (text: string) => void;
  onSubmit: () => void;
}

export default function OpenQuestion({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onSubmit,
}: Props) {
  const { title, question, maxLength, maxAnswersPerPerson, showAuthor, placeholder } = config;
  const { answers } = state;

  const myAnswers = answers.filter((a) => a.authorId === myUserId);
  const hasReachedLimit = myAnswers.length >= maxAnswersPerPerson;
  const canSubmit = draftText.trim().length > 0 && !hasReachedLimit;
  const charsLeft = maxLength - draftText.length;

  return (
    <div data-testid="oq-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="oq-title" className="text-xl font-bold text-center">
        {title}
      </h2>

      <div data-testid="oq-question" className="rounded-xl bg-indigo-50 border border-indigo-200 p-4 text-center">
        <p className="text-base font-medium text-indigo-800">{question}</p>
      </div>

      {!hasReachedLimit ? (
        <div className="flex flex-col gap-2">
          <textarea
            data-testid="oq-input"
            value={draftText}
            onChange={(e) => onDraftChange(e.target.value.slice(0, maxLength))}
            placeholder={placeholder ?? "輸入你的回答…"}
            rows={3}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <div className="flex justify-between items-center">
            <span
              data-testid="oq-chars-left"
              className={`text-xs ${charsLeft <= 10 ? "text-red-500" : "text-gray-400"}`}
            >
              {charsLeft}
            </span>
            <button
              data-testid="oq-submit-btn"
              disabled={!canSubmit}
              onClick={onSubmit}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              提交
            </button>
          </div>
        </div>
      ) : (
        <p data-testid="oq-limit-msg" className="text-center text-sm text-amber-600">
          已達提交上限（{maxAnswersPerPerson} 則）
        </p>
      )}

      <div className="flex items-center justify-between text-sm text-gray-500">
        <span>共 <span data-testid="oq-count">{answers.length}</span> 則回答</span>
      </div>

      {answers.length === 0 ? (
        <p data-testid="oq-empty" className="text-center text-gray-400 text-sm py-4">
          等待大家分享想法…
        </p>
      ) : (
        <div data-testid="oq-list" className="flex flex-col gap-2">
          {[...answers]
            .sort((a, b) => b.submittedAt - a.submittedAt)
            .map((ans) => (
              <div
                key={ans.id}
                data-testid={`oq-answer-${ans.id}`}
                className={[
                  "rounded-xl border p-3",
                  ans.authorId === myUserId
                    ? "border-indigo-300 bg-indigo-50"
                    : "border-gray-200 bg-white",
                ].join(" ")}
              >
                <p data-testid={`oq-text-${ans.id}`} className="text-sm">
                  {ans.text}
                </p>
                {showAuthor && (
                  <p
                    data-testid={`oq-author-${ans.id}`}
                    className="text-xs text-gray-400 mt-1"
                  >
                    — {ans.authorName}
                  </p>
                )}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
