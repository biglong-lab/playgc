import { Flame, Shuffle, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HotSeatConfig {
  title: string;
  instructions?: string;
  durationSeconds: number;
  maxQuestionsPerRound: number;
}

export interface HotSeatQuestion {
  id: string;
  askerId: string;
  askerName: string;
  text: string;
  askedAt: number;
}

export interface HotSeatSession {
  userId: string;
  userName: string;
  startedAt: number;
  questions: HotSeatQuestion[];
}

export interface HotSeatState extends Record<string, unknown> {
  current: HotSeatSession | null;
  history: HotSeatSession[];
  volunteers: { userId: string; userName: string }[];
}

interface Props {
  config: HotSeatConfig;
  state: HotSeatState;
  myUserId: string;
  myUserName: string;
  draftQuestion: string;
  onDraftChange: (v: string) => void;
  onVolunteer: () => void;
  onAskQuestion: () => void;
  onEndRound: () => void;
}

export default function HotSeat({
  config,
  state,
  myUserId,
  myUserName,
  draftQuestion,
  onDraftChange,
  onVolunteer,
  onAskQuestion,
  onEndRound,
}: Props) {
  const { title, instructions, maxQuestionsPerRound } = config;
  const { current, history, volunteers } = state;

  const isOnSeat = current?.userId === myUserId;
  const isVolunteering = volunteers.some((v) => v.userId === myUserId);
  const questionCount = current?.questions.length ?? 0;
  const canAsk = !isOnSeat && questionCount < maxQuestionsPerRound;

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex flex-col px-4 py-6 gap-5" data-testid="hot-seat-root">
      <div className="text-center">
        <div className="text-4xl mb-1">🔥</div>
        <h1 className="text-2xl font-bold text-gray-800" data-testid="hs-title">{title}</h1>
        {instructions && (
          <p className="text-gray-500 text-sm mt-1" data-testid="hs-instructions">{instructions}</p>
        )}
      </div>

      {current ? (
        <>
          <div className="bg-white rounded-2xl shadow-lg border-2 border-red-200 p-5 text-center" data-testid="hs-current-seat">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-orange-400 flex items-center justify-center mx-auto mb-3">
              <Flame className="w-8 h-8 text-white" />
            </div>
            <p className="text-xs text-gray-400 mb-1">現在上場</p>
            <p className="text-xl font-bold text-red-600" data-testid="hs-current-name">{current.userName}</p>
            <p className="text-sm text-gray-400 mt-1">
              已收到 <span data-testid="hs-question-count">{questionCount}</span> / {maxQuestionsPerRound} 個問題
            </p>
            {isOnSeat && (
              <Button
                onClick={onEndRound}
                variant="outline"
                className="mt-3 text-red-600 border-red-300 hover:bg-red-50"
                data-testid="hs-end-btn"
              >
                結束回合
              </Button>
            )}
          </div>

          {!isOnSeat && canAsk && (
            <div className="bg-white rounded-2xl shadow p-4" data-testid="hs-ask-form">
              <p className="text-sm font-medium text-gray-600 mb-2">提問給 {current.userName}</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draftQuestion}
                  onChange={(e) => onDraftChange(e.target.value)}
                  placeholder="你想問什麼？"
                  maxLength={80}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                  data-testid="hs-question-input"
                />
                <Button
                  onClick={onAskQuestion}
                  disabled={!draftQuestion.trim()}
                  className="bg-red-500 hover:bg-red-600 text-white"
                  data-testid="hs-ask-btn"
                >
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {!isOnSeat && !canAsk && questionCount >= maxQuestionsPerRound && (
            <div className="text-center text-sm text-gray-400" data-testid="hs-max-questions">
              已達本輪問題上限
            </div>
          )}

          {current.questions.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4" data-testid="hs-question-list">
              <p className="text-xs text-gray-400 mb-3">本輪問題：</p>
              <div className="flex flex-col gap-2">
                {current.questions.map((q) => (
                  <div
                    key={q.id}
                    className="bg-orange-50 rounded-lg px-3 py-2 text-sm"
                    data-testid={`hs-q-${q.id}`}
                  >
                    <span className="font-medium text-orange-600 mr-2">{q.askerName}：</span>
                    <span className="text-gray-700">{q.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white rounded-2xl shadow p-6 text-center" data-testid="hs-waiting">
          <p className="text-gray-500 text-sm mb-4">目前沒有人上場，第一個舉手吧！</p>
          {!isVolunteering ? (
            <Button
              onClick={onVolunteer}
              className="bg-red-500 hover:bg-red-600 text-white"
              data-testid="hs-volunteer-btn"
            >
              <Flame className="w-4 h-4 mr-2" />
              我來上場！
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-orange-500" data-testid="hs-volunteered-msg">
              <CheckCircle2 className="w-5 h-5" />
              <span>等待主持人安排…</span>
            </div>
          )}
        </div>
      )}

      {volunteers.length > 0 && !current && (
        <div className="bg-white rounded-xl p-3" data-testid="hs-volunteer-list">
          <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
            <Shuffle className="w-3 h-3" />
            排隊等待（{volunteers.length} 人）
          </p>
          <div className="flex flex-wrap gap-2">
            {volunteers.map((v) => (
              <span
                key={v.userId}
                className="bg-orange-50 text-orange-600 text-xs px-2 py-1 rounded-full"
                data-testid={`hs-vol-${v.userId}`}
              >
                {v.userName}
              </span>
            ))}
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-xl p-3" data-testid="hs-history">
          <p className="text-xs text-gray-400 mb-2">已完成 {history.length} 輪</p>
          <div className="flex flex-wrap gap-2">
            {history.map((h, idx) => (
              <span
                key={`${h.userId}-${idx}`}
                className="flex items-center gap-1 bg-gray-50 text-gray-500 text-xs px-2 py-1 rounded-full"
                data-testid={`hs-history-${idx}`}
              >
                <CheckCircle2 className="w-3 h-3 text-green-400" />
                {h.userName}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
