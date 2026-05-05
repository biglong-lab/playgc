import { useState } from "react";

export interface AudQuestion extends Record<string, unknown> {
  questionId: string;
  userId: string;
  userName: string;
  text: string;
  votes: string[];
  answered: boolean;
}

export interface AudienceQConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  showAuthor: boolean;
}

export interface AudienceQState extends Record<string, unknown> {
  questions: AudQuestion[];
}

const DEFAULT_CONFIG: AudienceQConfig = {
  title: "現場提問",
  prompt: "有什麼想問的嗎？",
  maxLength: 100,
  showAuthor: true,
};

interface Props {
  config: AudienceQConfig;
  state: AudienceQState;
  myUserId: string;
  onSubmitQuestion: (text: string) => void;
  onUpvote: (questionId: string) => void;
  onMarkAnswered: (questionId: string) => void;
}

export default function AudienceQ({
  config,
  state,
  myUserId,
  onSubmitQuestion,
  onUpvote,
  onMarkAnswered,
}: Props) {
  const [text, setText] = useState("");

  const maxLength = config.maxLength ?? DEFAULT_CONFIG.maxLength;
  const showAuthor = config.showAuthor ?? DEFAULT_CONFIG.showAuthor;

  const myQuestion = state.questions.find((q) => q.userId === myUserId);
  const overLimit = text.length > maxLength;
  const canSubmit = text.trim().length > 0 && !overLimit && !myQuestion;

  const sorted = [...state.questions].sort((a, b) => {
    if (a.answered !== b.answered) return a.answered ? 1 : -1;
    return b.votes.length - a.votes.length;
  });

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmitQuestion(text.trim());
    setText("");
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="aq-title" className="text-xl font-bold text-center">
        {config.title || DEFAULT_CONFIG.title}
      </h2>
      <p data-testid="aq-prompt" className="text-center text-gray-600">
        {config.prompt || DEFAULT_CONFIG.prompt}
      </p>

      {!myQuestion && (
        <div className="space-y-2">
          <textarea
            data-testid="aq-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="輸入你的問題…"
            rows={3}
            className="w-full border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                data-testid="aq-char-count"
                className={`text-xs ${
                  overLimit ? "text-red-500" : "text-gray-400"
                }`}
              >
                {text.length}/{maxLength}
              </span>
              {overLimit && (
                <span
                  data-testid="aq-char-error"
                  className="text-xs text-red-500"
                >
                  超過字數限制
                </span>
              )}
            </div>
            <button
              data-testid="aq-submit-btn"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-40 hover:bg-blue-700 disabled:cursor-not-allowed"
            >
              送出
            </button>
          </div>
        </div>
      )}

      {myQuestion && (
        <p
          data-testid="aq-submitted-msg"
          className="text-center text-sm text-green-600"
        >
          ✅ 已送出你的問題
        </p>
      )}

      <p
        data-testid="aq-question-count"
        className="text-xs text-center text-gray-400"
      >
        共 {state.questions.length} 個問題
      </p>

      {sorted.length === 0 ? (
        <div
          data-testid="aq-empty"
          className="text-center text-gray-400 py-8"
        >
          還沒有問題
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((q) => {
            const hasVoted = q.votes.includes(myUserId);
            const isOwn = q.userId === myUserId;
            return (
              <div
                key={q.questionId}
                data-testid={`aq-question-${q.questionId}`}
                className={`p-3 rounded-lg border ${
                  q.answered
                    ? "border-green-200 bg-green-50"
                    : "border-gray-200 bg-white"
                }`}
              >
                <p className="text-sm">{q.text}</p>
                {showAuthor && (
                  <p
                    data-testid={`aq-author-${q.questionId}`}
                    className="text-xs text-gray-400 mt-1"
                  >
                    — {q.userName}
                    {isOwn && (
                      <span
                        data-testid={`aq-my-badge-${q.questionId}`}
                      >
                        {" "}
                        （我）
                      </span>
                    )}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    data-testid={`aq-upvote-${q.questionId}`}
                    onClick={() => onUpvote(q.questionId)}
                    disabled={isOwn || q.answered}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
                      hasVoted
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-100 text-gray-600 hover:bg-blue-50"
                    } disabled:opacity-40`}
                  >
                    👍{" "}
                    <span
                      data-testid={`aq-vote-count-${q.questionId}`}
                    >
                      {q.votes.length}
                    </span>
                  </button>
                  {!q.answered && (
                    <button
                      data-testid={`aq-mark-answered-${q.questionId}`}
                      onClick={() => onMarkAnswered(q.questionId)}
                      className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700"
                    >
                      ✓ 已回答
                    </button>
                  )}
                  {q.answered && (
                    <span
                      data-testid={`aq-answered-badge-${q.questionId}`}
                      className="text-xs text-green-600 font-medium"
                    >
                      ✅ 已回答
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
