import { Zap, CheckCircle2, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ChallengeBoardConfig {
  title: string;
  prompt?: string;
  maxChallengesPerPerson: number;
  maxChallengeLength: number;
  rewardEmoji?: string;
}

export interface Challenge {
  id: string;
  creatorId: string;
  creatorName: string;
  text: string;
  acceptors: string[];
  completors: string[];
  createdAt: number;
}

export interface ChallengeBoardState extends Record<string, unknown> {
  challenges: Challenge[];
}

interface Props {
  config: ChallengeBoardConfig;
  state: ChallengeBoardState;
  myUserId: string;
  draftText: string;
  onDraftChange: (v: string) => void;
  onPost: () => void;
  onAccept: (challengeId: string) => void;
  onComplete: (challengeId: string) => void;
}

export default function ChallengeBoard({
  config,
  state,
  myUserId,
  draftText,
  onDraftChange,
  onPost,
  onAccept,
  onComplete,
}: Props) {
  const {
    title,
    prompt = "發布挑戰，看誰敢接！",
    maxChallengesPerPerson,
    maxChallengeLength,
    rewardEmoji = "⚡",
  } = config;

  const { challenges } = state;

  const myPostedCount = challenges.filter((c) => c.creatorId === myUserId).length;
  const canPost = myPostedCount < maxChallengesPerPerson && draftText.trim().length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex flex-col px-4 py-6 gap-4" data-testid="challenge-board-root">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center justify-center gap-2" data-testid="cb-title">
          <Zap className="w-6 h-6 text-amber-500" />
          {title}
        </h1>
        <p className="text-gray-500 text-sm mt-1" data-testid="cb-prompt">{prompt}</p>
      </div>

      {/* Stats */}
      <div className="text-center text-sm text-gray-400">
        <span data-testid="cb-challenge-count">{challenges.length}</span> 個挑戰 · 我發了{" "}
        <span data-testid="cb-my-count">{myPostedCount}</span>/{maxChallengesPerPerson}
      </div>

      {/* Post form */}
      {myPostedCount < maxChallengesPerPerson ? (
        <div className="bg-white rounded-2xl shadow p-4 flex flex-col gap-3" data-testid="cb-post-form">
          <div className="flex items-center gap-2 text-amber-600 text-sm font-medium">
            <Plus className="w-4 h-4" />
            發布新挑戰
          </div>
          <div className="flex gap-2">
            <Input
              value={draftText}
              onChange={(e) => onDraftChange(e.target.value)}
              placeholder="寫下你的挑戰…"
              maxLength={maxChallengeLength}
              className="flex-1"
              data-testid="cb-draft-input"
            />
            <Button
              onClick={onPost}
              disabled={!canPost}
              className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
              data-testid="cb-post-btn"
            >
              發布
            </Button>
          </div>
          <span className="text-xs text-gray-400 text-right">{maxChallengeLength - draftText.length} 字</span>
        </div>
      ) : (
        <div className="text-center text-sm text-gray-400 bg-white rounded-xl py-3" data-testid="cb-max-reached">
          已達發布上限
        </div>
      )}

      {/* Challenge list */}
      {challenges.length === 0 ? (
        <div className="text-center text-gray-400 py-8" data-testid="cb-empty">
          還沒有挑戰，第一個發布吧！
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="cb-challenge-list">
          {challenges.map((challenge) => {
            const isOwn = challenge.creatorId === myUserId;
            const hasAccepted = challenge.acceptors.includes(myUserId);
            const hasCompleted = challenge.completors.includes(myUserId);

            return (
              <div
                key={challenge.id}
                className={`bg-white rounded-2xl shadow p-4 ${hasCompleted ? "opacity-75" : ""}`}
                data-testid={`cb-challenge-${challenge.id}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0">{rewardEmoji}</span>
                  <div className="flex-1">
                    <p className="text-gray-800 font-medium" data-testid={`cb-text-${challenge.id}`}>{challenge.text}</p>
                    <p className="text-xs text-gray-400 mt-1" data-testid={`cb-creator-${challenge.id}`}>
                      {isOwn ? "我發布的" : `by ${challenge.creatorName}`}
                    </p>

                    {/* Acceptors / completors */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="flex items-center gap-1 text-xs text-gray-500" data-testid={`cb-acceptor-count-${challenge.id}`}>
                        <Users className="w-3 h-3" />
                        {challenge.acceptors.length} 人接受
                      </span>
                      {challenge.completors.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-green-600" data-testid={`cb-completor-count-${challenge.id}`}>
                          <CheckCircle2 className="w-3 h-3" />
                          {challenge.completors.length} 人完成
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {!isOwn && (
                    <div className="flex flex-col gap-1 shrink-0">
                      {!hasAccepted && !hasCompleted && (
                        <Button
                          size="sm"
                          onClick={() => onAccept(challenge.id)}
                          className="bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs"
                          data-testid={`cb-accept-btn-${challenge.id}`}
                        >
                          接受!
                        </Button>
                      )}
                      {hasAccepted && !hasCompleted && (
                        <Button
                          size="sm"
                          onClick={() => onComplete(challenge.id)}
                          className="bg-green-100 hover:bg-green-200 text-green-700 text-xs"
                          data-testid={`cb-complete-btn-${challenge.id}`}
                        >
                          完成✓
                        </Button>
                      )}
                      {hasCompleted && (
                        <span className="text-green-600 text-xs font-medium flex items-center gap-1" data-testid={`cb-done-${challenge.id}`}>
                          <CheckCircle2 className="w-3 h-3" />
                          已完成
                        </span>
                      )}
                    </div>
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
