import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface FlashCardItem extends Record<string, unknown> {
  cardId: string;
  front: string;
  back: string;
}

export interface PlayerAnswer extends Record<string, unknown> {
  answerId: string;
  userId: string;
  userName: string;
  cardId: string;
  answer: string;
  selfScore: number | null;
}

export interface FlashCardConfig extends Record<string, unknown> {
  title: string;
  cards: FlashCardItem[];
}

export interface FlashCardState extends Record<string, unknown> {
  currentCardIndex: number;
  answers: PlayerAnswer[];
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): FlashCardConfig {
  const cards = Array.isArray(raw.cards)
    ? (raw.cards as FlashCardItem[])
    : [
        { cardId: "c1", front: "什麼是主動聆聽？", back: "全神貫注聆聽、不打斷、給予回饋" },
        { cardId: "c2", front: "說出一個有效溝通技巧", back: "使用「我」句子，表達感受而非指責" },
      ];
  return {
    title: (raw.title as string) || "閃卡測驗",
    cards,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FlashCard({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: FlashCardState = { currentCardIndex: 0, answers: [], revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<FlashCardState>({
    gameId,
    sessionId,
    pageId,
    type: "flash_card",
    defaultState,
  });

  const [answerText, setAnswerText] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="fc-loading" />
      </div>
    );
  }

  const currentCard = cfg.cards[state.currentCardIndex];
  const isFinished = state.currentCardIndex >= cfg.cards.length;

  const myCurrentAnswer = state.answers.find(
    (a) => a.userId === userId && a.cardId === currentCard?.cardId,
  );

  function handleSubmitAnswer() {
    if (!answerText.trim() || myCurrentAnswer || !currentCard) return;
    const answerId = `${userId}-${currentCard.cardId}-${Date.now()}`;
    updateState({
      ...state,
      answers: [
        ...state.answers,
        { answerId, userId, userName, cardId: currentCard.cardId, answer: answerText.trim(), selfScore: null },
      ],
    });
    setAnswerText("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  function handleSelfScore(score: number) {
    if (!myCurrentAnswer) return;
    const updated = state.answers.map((a) =>
      a.answerId === myCurrentAnswer.answerId ? { ...a, selfScore: score } : a,
    );
    updateState({ ...state, answers: updated });
  }

  function handleNext() {
    updateState({ ...state, currentCardIndex: state.currentCardIndex + 1, revealed: false });
  }

  const totalAnswers = state.answers.length;
  const myTotalScore = state.answers
    .filter((a) => a.userId === userId && a.selfScore === 1)
    .length;
  const myTotalAnswered = state.answers.filter((a) => a.userId === userId).length;

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="fc-title">{cfg.title}</h2>
      <p className="text-sm text-gray-500" data-testid="fc-progress">
        卡片 {Math.min(state.currentCardIndex + 1, cfg.cards.length)} / {cfg.cards.length}
      </p>
      <p className="text-sm text-gray-400" data-testid="fc-answer-count">作答數：{totalAnswers}</p>

      {!isFinished && currentCard && (
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 rounded-xl border-2 border-blue-200 min-h-24 flex items-center justify-center">
            <p className="text-lg font-semibold text-center" data-testid="fc-front">
              {currentCard.front}
            </p>
          </div>

          {state.revealed && (
            <div className="p-4 bg-green-50 rounded-xl border-2 border-green-200" data-testid="fc-back">
              <p className="text-sm text-green-600 font-semibold mb-1">解答：</p>
              <p className="text-green-800">{currentCard.back}</p>
            </div>
          )}

          {!myCurrentAnswer && !state.revealed && (
            <div className="space-y-2">
              <textarea
                className="w-full border rounded px-3 py-2 h-20"
                placeholder="寫下你的回答..."
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                data-testid="fc-answer-input"
                maxLength={200}
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
                disabled={!answerText.trim()}
                onClick={handleSubmitAnswer}
                data-testid="fc-submit-btn"
              >
                提交作答
              </button>
            </div>
          )}

          {myCurrentAnswer && (
            <div className="p-2 bg-gray-50 rounded" data-testid="fc-my-answer">
              <p className="text-sm text-gray-600">我的作答：{myCurrentAnswer.answer}</p>
            </div>
          )}

          {state.revealed && myCurrentAnswer && myCurrentAnswer.selfScore === null && (
            <div className="flex gap-3" data-testid="fc-self-score">
              <button
                className="flex-1 py-2 bg-green-500 text-white rounded font-semibold"
                onClick={() => handleSelfScore(1)}
                data-testid="fc-score-correct"
              >
                ✅ 答對了！
              </button>
              <button
                className="flex-1 py-2 bg-red-400 text-white rounded font-semibold"
                onClick={() => handleSelfScore(0)}
                data-testid="fc-score-wrong"
              >
                ❌ 再加油
              </button>
            </div>
          )}

          {state.revealed && myCurrentAnswer && myCurrentAnswer.selfScore !== null && (
            <p className="text-sm text-center font-semibold" data-testid="fc-scored">
              {myCurrentAnswer.selfScore === 1 ? "你答對了 🎉" : "繼續努力 💪"}
            </p>
          )}

          {isTeamLead && !state.revealed && (
            <button
              className="px-4 py-2 bg-orange-500 text-white rounded"
              onClick={handleReveal}
              data-testid="fc-reveal-btn"
            >
              翻牌揭曉
            </button>
          )}

          {isTeamLead && state.revealed && state.currentCardIndex < cfg.cards.length - 1 && (
            <button
              className="px-4 py-2 bg-indigo-600 text-white rounded"
              onClick={handleNext}
              data-testid="fc-next-btn"
            >
              下一張卡片
            </button>
          )}

          {isTeamLead && state.revealed && state.currentCardIndex >= cfg.cards.length - 1 && (
            <button
              className="px-4 py-2 bg-purple-600 text-white rounded"
              onClick={handleNext}
              data-testid="fc-finish-btn"
            >
              完成測驗
            </button>
          )}
        </div>
      )}

      {isFinished && (
        <div className="text-center p-6 bg-purple-50 rounded-xl" data-testid="fc-result">
          <p className="text-2xl font-bold text-purple-700">測驗完成！</p>
          <p className="text-lg mt-2" data-testid="fc-my-score">
            你的得分：{myTotalScore} / {myTotalAnswered}
          </p>
          <p className="text-sm text-gray-500 mt-1">全隊共 {totalAnswers} 次作答</p>
        </div>
      )}
    </div>
  );
}

export default FlashCard;
