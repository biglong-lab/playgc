import React, { useState } from "react";

export interface MindSyncConfig extends Record<string, unknown> {
  title: string;
  description: string;
  questions: string[];
  maxAnswerLength: number;
}

export interface MindAnswer extends Record<string, unknown> {
  answerId: string;
  userId: string;
  userName: string;
  questionIdx: number;
  answer: string;
}

export interface MindSyncState extends Record<string, unknown> {
  answers: MindAnswer[];
  revealed: boolean;
}

interface Props {
  config: MindSyncConfig;
  state: MindSyncState;
  myUserId: string;
  onSubmitAnswers: (answers: { questionIdx: number; answer: string }[]) => void;
  onReveal: () => void;
}

export default function MindSync({ config, state, myUserId, onSubmitAnswers, onReveal }: Props) {
  const { title, description, questions, maxAnswerLength } = config;
  const { answers, revealed } = state;

  const myAnswers = answers.filter((a) => a.userId === myUserId);
  const hasSubmitted = myAnswers.length === questions.length;

  const [drafts, setDrafts] = useState<string[]>(() => questions.map(() => ""));

  const allFilled = drafts.every((d) => d.trim().length > 0 && d.length <= maxAnswerLength);

  const submitterCount = new Set(answers.map((a) => a.userId)).size;

  function handleSubmit() {
    if (!allFilled || hasSubmitted) return;
    onSubmitAnswers(questions.map((_, i) => ({ questionIdx: i, answer: drafts[i].trim() })));
    setDrafts(questions.map(() => ""));
  }

  function getAnswersForQuestion(qIdx: number) {
    return answers.filter((a) => a.questionIdx === qIdx);
  }

  function getGroups(qIdx: number): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    getAnswersForQuestion(qIdx).forEach((a) => {
      const key = a.answer.trim().toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(a.userName);
    });
    return groups;
  }

  return (
    <div data-testid="ms-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <h2 data-testid="ms-title" className="text-xl font-bold text-center">
        {title}
      </h2>
      <p data-testid="ms-description" className="text-sm text-center text-gray-600 bg-purple-50 p-3 rounded-xl border border-purple-100">
        {description}
      </p>

      <div data-testid="ms-submitter-count" className="text-center text-sm text-gray-500">
        <span className="font-semibold text-purple-600">{submitterCount}</span> 人已作答
      </div>

      {!hasSubmitted && !revealed && (
        <div className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-1">
              <label className="text-sm font-semibold text-gray-700">
                <span data-testid={`ms-question-${i}`}>{i + 1}. {q}</span>
              </label>
              <input
                data-testid={`ms-answer-input-${i}`}
                type="text"
                value={drafts[i]}
                onChange={(e) => {
                  const next = [...drafts];
                  next[i] = e.target.value;
                  setDrafts(next);
                }}
                placeholder="你的答案…"
                maxLength={maxAnswerLength + 5}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
              />
              {drafts[i].length > maxAnswerLength && (
                <p data-testid={`ms-answer-error-${i}`} className="text-xs text-red-500">
                  最多 {maxAnswerLength} 字
                </p>
              )}
            </div>
          ))}

          <button
            data-testid="ms-submit-btn"
            onClick={handleSubmit}
            disabled={!allFilled}
            className="w-full py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            送出我的答案
          </button>
        </div>
      )}

      {hasSubmitted && !revealed && (
        <div data-testid="ms-submitted-msg" className="p-3 bg-green-50 rounded-xl border border-green-200 text-center">
          <p className="text-green-700 font-semibold text-sm">✅ 已送出！等待所有人完成</p>
          <div className="mt-2 flex flex-col gap-1">
            {myAnswers
              .sort((a, b) => a.questionIdx - b.questionIdx)
              .map((a) => (
                <p key={a.answerId} className="text-xs text-gray-500">
                  Q{a.questionIdx + 1}: {a.answer}
                </p>
              ))}
          </div>
        </div>
      )}

      {!revealed ? (
        <button
          data-testid="ms-reveal-btn"
          onClick={onReveal}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700"
        >
          揭曉默契結果
        </button>
      ) : (
        <div data-testid="ms-result" className="flex flex-col gap-4">
          {answers.length === 0 ? (
            <div data-testid="ms-empty" className="text-center text-gray-400 p-8">
              還沒有人作答
            </div>
          ) : (
            questions.map((q, i) => {
              const groups = getGroups(i);
              const sortedGroups = Array.from(groups.entries()).sort(
                (a, b) => b[1].length - a[1].length
              );
              return (
                <div
                  key={i}
                  data-testid={`ms-question-result-${i}`}
                  className="p-4 bg-white rounded-xl border border-purple-100 shadow-sm"
                >
                  <p className="text-sm font-bold text-purple-700 mb-2">{i + 1}. {q}</p>
                  {sortedGroups.map(([answer, names]) => (
                    <div
                      key={answer}
                      data-testid={`ms-group-${i}-${answer}`}
                      className={`flex items-center gap-2 py-1 px-2 rounded-lg mb-1 ${
                        names.length > 1 ? "bg-purple-50 border border-purple-200" : "bg-gray-50"
                      }`}
                    >
                      {names.length > 1 && (
                        <span className="text-purple-600 text-xs font-bold">🧠 默契！</span>
                      )}
                      <span className="text-sm font-semibold text-gray-700">「{answer}」</span>
                      <span className="text-xs text-gray-500">{names.join("、")}</span>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
