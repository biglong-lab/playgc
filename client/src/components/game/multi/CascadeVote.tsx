import { Loader2, ChevronRight, BarChart2 } from "lucide-react";

export interface CascadeQuestion extends Record<string, unknown> {
  questionId: string;
  text: string;
  options: string[];
}

export interface CascadeAnswer extends Record<string, unknown> {
  answerId: string;
  userId: string;
  userName: string;
  questionId: string;
  optionIndex: number;
}

export interface CascadeVoteConfig extends Record<string, unknown> {
  title: string;
  questions: CascadeQuestion[];
}

export interface CascadeVoteState extends Record<string, unknown> {
  currentIndex: number;
  answers: CascadeAnswer[];
  finished: boolean;
}

interface CascadeVoteProps {
  config: CascadeVoteConfig;
  state: CascadeVoteState;
  userId: string;
  isTeamLead?: boolean;
  isLoaded: boolean;
  onAnswer: (questionId: string, optionIndex: number) => void;
  onAdvance: () => void;
  onFinish: () => void;
}

export function CascadeVote({
  config,
  state,
  userId,
  isTeamLead,
  isLoaded,
  onAnswer,
  onAdvance,
  onFinish,
}: CascadeVoteProps) {
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const { title, questions } = config;
  const { currentIndex, answers, finished } = state;

  if (questions.length === 0) {
    return <p className="text-center text-gray-400 p-8">尚無問題</p>;
  }

  const currentQ = questions[currentIndex] ?? questions[questions.length - 1];
  const isLast = currentIndex >= questions.length - 1;

  const answersForQ = (qId: string) => answers.filter((a) => a.questionId === qId);
  const myAnswerForQ = (qId: string) =>
    answers.find((a) => a.questionId === qId && a.userId === userId);

  const tally = (qId: string, optIdx: number) =>
    answers.filter((a) => a.questionId === qId && a.optionIndex === optIdx).length;

  const totalForQ = (qId: string) => answersForQ(qId).length;

  if (finished) {
    return (
      <div data-testid="cv-finished" className="p-4 max-w-lg mx-auto space-y-4">
        <h2 className="text-xl font-bold text-center text-blue-700">{title}</h2>
        <p className="text-center text-sm text-gray-500">投票結束！</p>
        {questions.map((q, qi) => (
          <div key={q.questionId} data-testid={`cv-summary-${qi}`} className="bg-blue-50 rounded-xl p-3 space-y-2">
            <p className="text-sm font-semibold text-blue-800">Q{qi + 1}: {q.text}</p>
            {q.options.map((opt, oi) => {
              const count = tally(q.questionId, oi);
              const total = totalForQ(q.questionId);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={oi} data-testid={`cv-result-${qi}-${oi}`} className="flex items-center gap-2 text-xs">
                  <span className="w-24 truncate text-gray-700">{opt}</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-600 w-8 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const myAnswer = myAnswerForQ(currentQ.questionId);
  const answerCount = answersForQ(currentQ.questionId).length;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h2 data-testid="cv-title" className="text-xl font-bold text-center text-blue-700">
        {title}
      </h2>

      <div className="flex justify-center gap-1 mb-2">
        {questions.map((_, i) => (
          <div
            key={i}
            data-testid={`cv-step-${i}`}
            className={`h-2 rounded-full transition-all ${
              i < currentIndex
                ? "bg-blue-500 w-6"
                : i === currentIndex
                ? "bg-blue-600 w-8"
                : "bg-gray-200 w-4"
            }`}
          />
        ))}
      </div>

      <p data-testid="cv-question-index" className="text-xs text-gray-500 text-center">
        第 {currentIndex + 1} / {questions.length} 題
      </p>

      <div
        data-testid="cv-question-text"
        className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-base font-medium text-blue-800 text-center"
      >
        {currentQ.text}
      </div>

      <p data-testid="cv-answer-count" className="text-sm text-gray-500 text-center">
        已有 {answerCount} 人回答
      </p>

      {!myAnswer && (
        <div data-testid="cv-options" className="space-y-2">
          {currentQ.options.map((opt, oi) => (
            <button
              key={oi}
              data-testid={`cv-option-${oi}`}
              onClick={() => onAnswer(currentQ.questionId, oi)}
              className="w-full text-left bg-white border border-blue-200 hover:bg-blue-50 rounded-xl p-3 text-sm font-medium text-gray-700 transition-colors"
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {myAnswer && (
        <div
          data-testid="cv-my-answer"
          className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700"
        >
          <BarChart2 size={16} />
          你選了：<strong>{currentQ.options[myAnswer.optionIndex]}</strong>
        </div>
      )}

      {isTeamLead && (
        <button
          data-testid={isLast ? "cv-finish-btn" : "cv-advance-btn"}
          onClick={isLast ? onFinish : onAdvance}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-xl text-sm font-medium"
        >
          <ChevronRight size={16} />
          {isLast ? "結束投票" : "下一題"}
        </button>
      )}
    </div>
  );
}

export default CascadeVote;
