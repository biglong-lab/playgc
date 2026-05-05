import { useMemo } from "react";
import { Users, Clock, CheckCircle2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SpeedNetworkingConfig {
  title: string;
  prompt?: string;
  roundDurationSeconds: number;
  questions: string[];
  showMatchedCount: boolean;
}

export interface NetworkingMatch {
  userId: string;
  userName: string;
  matchedAt: number;
}

export interface NetworkingParticipant {
  userId: string;
  userName: string;
  matches: NetworkingMatch[];
  joinedAt: number;
}

export interface SpeedNetworkingState extends Record<string, unknown> {
  participants: NetworkingParticipant[];
  currentRound: number;
  roundStartedAt: number | null;
  phase: "waiting" | "networking" | "done";
}

interface Props {
  config: SpeedNetworkingConfig;
  state: SpeedNetworkingState;
  myUserId: string;
  onJoin: () => void;
  onMatchConfirm: (targetUserId: string) => void;
  onNextRound: () => void;
}

const DEFAULT_QUESTIONS = [
  "你現在最專注的一件事是什麼？",
  "這次活動你最期待什麼？",
  "用一個詞描述你自己？",
];

export default function SpeedNetworking({
  config,
  state,
  myUserId,
  onJoin,
  onMatchConfirm,
  onNextRound,
}: Props) {
  const {
    title,
    prompt = "輪流和不同人對話，認識新朋友！",
    roundDurationSeconds,
    questions = DEFAULT_QUESTIONS,
    showMatchedCount,
  } = config;

  const { participants, currentRound, phase } = state;

  const me = participants.find((p) => p.userId === myUserId);
  const hasJoined = !!me;
  const myMatchIds = me?.matches.map((m) => m.userId) ?? [];

  const currentQuestion = questions[(currentRound - 1) % questions.length] ?? questions[0];

  const pairedWith = useMemo(() => {
    if (phase !== "networking" || participants.length < 2) return null;
    const others = participants.filter((p) => p.userId !== myUserId);
    const idx = participants.findIndex((p) => p.userId === myUserId);
    if (idx === -1) return null;
    const pairIdx = (idx + currentRound) % others.length;
    return others[pairIdx] ?? null;
  }, [participants, myUserId, currentRound, phase]);

  const hasMergedCurrentPartner = pairedWith ? myMatchIds.includes(pairedWith.userId) : false;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col px-4 py-6 gap-4" data-testid="speed-networking-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800" data-testid="sn-title">{title}</h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="sn-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="flex justify-center gap-6 text-sm text-gray-500">
        <span className="flex items-center gap-1" data-testid="sn-participant-count">
          <Users className="w-4 h-4" />
          {participants.length} 人
        </span>
        <span className="flex items-center gap-1" data-testid="sn-round">
          第 <span data-testid="sn-round-num">{currentRound}</span> 輪
        </span>
        {showMatchedCount && (
          <span className="flex items-center gap-1" data-testid="sn-matched-count">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            認識了 {myMatchIds.length} 人
          </span>
        )}
      </div>

      {/* Phase: waiting */}
      {phase === "waiting" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="text-5xl">👋</div>
          <p className="text-gray-600 text-center" data-testid="sn-waiting-msg">
            等待活動開始，先加入名單吧！
          </p>
          {!hasJoined ? (
            <Button
              onClick={onJoin}
              className="bg-purple-500 hover:bg-purple-600 text-white px-8"
              data-testid="sn-join-btn"
            >
              加入速配！
            </Button>
          ) : (
            <div className="text-green-600 font-medium flex items-center gap-2" data-testid="sn-joined-msg">
              <CheckCircle2 className="w-5 h-5" />
              已加入，等待開始
            </div>
          )}

          {/* Participant list */}
          {participants.length > 0 && (
            <div className="w-full max-w-sm bg-white rounded-2xl shadow p-4" data-testid="sn-participant-list">
              <p className="text-xs text-gray-400 mb-2">已加入的人：</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => (
                  <span
                    key={p.userId}
                    className="bg-purple-50 text-purple-700 text-xs px-2 py-1 rounded-full"
                    data-testid={`sn-participant-${p.userId}`}
                  >
                    {p.userName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase: networking */}
      {phase === "networking" && (
        <div className="flex flex-col gap-4">
          {/* Question card */}
          <div className="bg-white rounded-2xl shadow p-4 border-l-4 border-purple-400">
            <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-2">
              <MessageCircle className="w-4 h-4" />
              本輪話題
            </div>
            <p className="text-gray-800 font-medium" data-testid="sn-question">{currentQuestion}</p>
          </div>

          {/* Timer */}
          <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
            <Clock className="w-4 h-4" />
            每輪 {roundDurationSeconds} 秒
          </div>

          {/* Current partner */}
          {pairedWith ? (
            <div className="bg-white rounded-2xl shadow p-5 flex flex-col items-center gap-3" data-testid="sn-partner-card">
              <div className="text-4xl">🤝</div>
              <p className="text-xs text-gray-400">這一輪你配對到</p>
              <p className="text-xl font-bold text-gray-800" data-testid="sn-partner-name">
                {pairedWith.userName}
              </p>
              {!hasMergedCurrentPartner ? (
                <Button
                  onClick={() => onMatchConfirm(pairedWith.userId)}
                  className="bg-green-500 hover:bg-green-600 text-white"
                  data-testid="sn-confirm-match-btn"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  完成對話 ✓
                </Button>
              ) : (
                <div className="text-green-600 text-sm font-medium flex items-center gap-1" data-testid="sn-match-confirmed">
                  <CheckCircle2 className="w-4 h-4" />
                  已記錄
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-400 py-4" data-testid="sn-no-partner">
              人數不足，稍等更多人加入
            </div>
          )}

          {/* Next round button */}
          <Button
            onClick={onNextRound}
            variant="outline"
            className="w-full"
            data-testid="sn-next-round-btn"
          >
            下一輪 →
          </Button>

          {/* Match history */}
          {myMatchIds.length > 0 && (
            <div className="bg-white rounded-2xl shadow p-4" data-testid="sn-match-history">
              <p className="text-xs text-gray-400 mb-2">已認識的人（{myMatchIds.length}）：</p>
              <div className="flex flex-wrap gap-2">
                {me?.matches.map((m) => (
                  <span
                    key={m.userId}
                    className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full flex items-center gap-1"
                    data-testid={`sn-match-${m.userId}`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {m.userName}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Phase: done */}
      {phase === "done" && (
        <div className="flex flex-col items-center gap-4 py-8" data-testid="sn-done-section">
          <div className="text-5xl">🎉</div>
          <h2 className="text-xl font-bold text-gray-800">速配完成！</h2>
          <p className="text-gray-500 text-center">
            你共認識了{" "}
            <span className="text-purple-600 font-bold" data-testid="sn-final-count">
              {myMatchIds.length}
            </span>{" "}
            位新朋友
          </p>
          <div className="w-full max-w-sm bg-white rounded-2xl shadow p-4">
            <p className="text-xs text-gray-400 mb-3">你認識的人：</p>
            <div className="flex flex-wrap gap-2">
              {me?.matches.map((m) => (
                <span
                  key={m.userId}
                  className="bg-purple-50 text-purple-700 text-sm px-3 py-1 rounded-full"
                  data-testid={`sn-done-match-${m.userId}`}
                >
                  {m.userName}
                </span>
              ))}
            </div>
            {myMatchIds.length === 0 && (
              <p className="text-gray-400 text-sm text-center" data-testid="sn-no-matches">還沒有認識的人</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
