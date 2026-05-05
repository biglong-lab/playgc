import React from "react";

export interface KnowledgeCheckQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
}

export interface KnowledgeCheckConfig {
  title: string;
  questions: KnowledgeCheckQuestion[];
  showExplanation: boolean;
  pointsPerCorrect: number;
}

export interface KcAnswer {
  userId: string;
  userName: string;
  questionId: string;
  selectedIndex: number;
  answeredAt: number;
}

export interface KnowledgeCheckState extends Record<string, unknown> {
  currentQuestionIndex: number;
  answers: KcAnswer[];
  revealed: boolean;
}

interface Props {
  config: KnowledgeCheckConfig;
  state: KnowledgeCheckState;
  myUserId: string;
  isHost: boolean;
  onAnswer: (selectedIndex: number) => void;
  onReveal: () => void;
  onNext: () => void;
}

export default function KnowledgeCheck({
  config,
  state,
  myUserId,
  isHost,
  onAnswer,
  onReveal,
  onNext,
}: Props) {
  const { title, questions, showExplanation, pointsPerCorrect } = config;
  const { currentQuestionIndex, answers, revealed } = state;

  const currentQ = questions[currentQuestionIndex];
  const isLastQuestion = currentQuestionIndex >= questions.length - 1;
  const isDone = currentQuestionIndex >= questions.length;

  if (isDone) {
    const myAnswers = answers.filter((a) => a.userId === myUserId);
    const correct = myAnswers.filter(
      (a) => questions.find((q) => q.id === a.questionId)?.correctIndex === a.selectedIndex
    ).length;
    const total = questions.length;
    return (
      <div data-testid="kc-done" className="flex flex-col gap-4 p-4 max-w-lg mx-auto text-center">
        <h2 data-testid="kc-title" className="text-xl font-bold">{title}</h2>
        <div className="py-6 text-5xl">🎉</div>
        <p data-testid="kc-final-score" className="text-2xl font-bold text-indigo-600">
          {correct} / {total}
        </p>
        <p className="text-sm text-gray-500">
          得分：<span data-testid="kc-points">{correct * pointsPerCorrect}</span> 分
        </p>
      </div>
    );
  }

  if (!currentQ) return null;

  const currentAnswers = answers.filter((a) => a.questionId === currentQ.id);
  const myCurrentAnswer = currentAnswers.find((a) => a.userId === myUserId);
  const answerCount = currentAnswers.length;

  const optionCounts = currentQ.options.map(
    (_, i) => currentAnswers.filter((a) => a.selectedIndex === i).length
  );

  return (
    <div data-testid="kc-root" className="flex flex-col gap-4 p-4 max-w-lg mx-auto">
      <div className="flex justify-between items-center">
        <h2 data-testid="kc-title" className="text-lg font-bold">{title}</h2>
        <span data-testid="kc-progress" className="text-xs text-gray-400">
          {currentQuestionIndex + 1} / {questions.length}
        </span>
      </div>

      <div data-testid="kc-question" className="rounded-xl bg-indigo-50 border border-indigo-200 p-4">
        <p className="font-medium">{currentQ.text}</p>
      </div>

      <div className="flex flex-col gap-2">
        {currentQ.options.map((opt, i) => {
          const isSelected = myCurrentAnswer?.selectedIndex === i;
          const isCorrect = i === currentQ.correctIndex;
          const count = optionCounts[i];
          const pct = answerCount > 0 ? Math.round((count / answerCount) * 100) : 0;

          let borderClass = "border-gray-200";
          let bgClass = "bg-white";
          if (revealed) {
            if (isCorrect) { borderClass = "border-green-500"; bgClass = "bg-green-50"; }
            else if (isSelected) { borderClass = "border-red-400"; bgClass = "bg-red-50"; }
          } else if (isSelected) {
            borderClass = "border-indigo-400"; bgClass = "bg-indigo-50";
          }

          return (
            <button
              key={i}
              data-testid={`kc-option-${i}`}
              disabled={!!myCurrentAnswer || revealed}
              onClick={() => onAnswer(i)}
              className={[
                "w-full p-3 rounded-xl border-2 text-left text-sm transition-all relative overflow-hidden",
                borderClass,
                bgClass,
                !myCurrentAnswer && !revealed ? "hover:border-indigo-300 hover:bg-indigo-50 cursor-pointer" : "",
              ].join(" ")}
            >
              {revealed && (
                <div
                  data-testid={`kc-bar-${i}`}
                  className="absolute inset-0 bg-indigo-100 opacity-40"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between">
                <span>{opt}</span>
                <div className="flex items-center gap-2">
                  {revealed && isCorrect && (
                    <span data-testid={`kc-correct-mark-${i}`} className="text-green-600 font-bold">✓</span>
                  )}
                  {revealed && (
                    <span data-testid={`kc-pct-${i}`} className="text-xs text-gray-500">{pct}%</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-sm text-gray-500 text-center">
        已有 <span data-testid="kc-answer-count">{answerCount}</span> 人作答
      </div>

      {showExplanation && revealed && currentQ.explanation && (
        <div data-testid="kc-explanation" className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
          {currentQ.explanation}
        </div>
      )}

      {isHost && !revealed && (
        <button
          data-testid="kc-reveal-btn"
          onClick={onReveal}
          className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold transition-colors"
        >
          揭曉答案
        </button>
      )}

      {isHost && revealed && (
        <button
          data-testid="kc-next-btn"
          onClick={onNext}
          className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
        >
          {isLastQuestion ? "結束" : "下一題"}
        </button>
      )}

      {!myCurrentAnswer && !revealed && (
        <p data-testid="kc-hint" className="text-center text-xs text-gray-400">
          選擇你的答案
        </p>
      )}

      {myCurrentAnswer && !revealed && (
        <p data-testid="kc-waiting-reveal" className="text-center text-sm text-green-600">
          ✅ 已作答，等待揭曉
        </p>
      )}
    </div>
  );
}
