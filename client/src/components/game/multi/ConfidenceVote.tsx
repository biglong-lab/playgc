import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface ConfVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  score: number;
}

interface ConfidenceVoteState extends Record<string, unknown> {
  votes: ConfVote[];
  revealed: boolean;
}

interface ConfidenceVoteConfig {
  question?: string;
  title?: string;
  maxScore?: number;
}

function extractConfig(raw: Record<string, unknown>): ConfidenceVoteConfig {
  return {
    question: typeof raw.question === "string" ? raw.question : "你對這個決定的信心程度？",
    title: typeof raw.title === "string" ? raw.title : "信心投票",
    maxScore: typeof raw.maxScore === "number" ? raw.maxScore : 5,
  };
}

export interface ConfidenceVoteProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ConfidenceVote({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: ConfidenceVoteProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);
  const maxScore = cfg.maxScore ?? 5;

  const { state, updateState, isLoaded } = useTeamPagePersistence<ConfidenceVoteState>({
    gameId,
    sessionId,
    pageId,
    type: "confidence_vote",
    defaultState: { votes: [], revealed: false },
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="cv-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myVote = state.votes.find((v) => v.userId === userId);

  function handleVote(score: number) {
    if (myVote) return;
    const vote: ConfVote = {
      voteId: `${userId}-${Date.now()}`,
      userId,
      userName,
      score,
    };
    updateState({ ...state, votes: [...state.votes, vote] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const total = state.votes.length;
  const avg = total > 0 ? state.votes.reduce((sum, v) => sum + v.score, 0) / total : 0;

  // 各分數分佈
  const dist: Record<number, number> = {};
  for (let i = 1; i <= maxScore; i++) dist[i] = 0;
  for (const v of state.votes) dist[v.score] = (dist[v.score] ?? 0) + 1;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="cv-title">
        {cfg.title ?? "信心投票"}
      </h2>
      <p className="text-center text-muted-foreground text-sm" data-testid="cv-question">
        {cfg.question}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="cv-count">
        已投票：{total} 人
      </p>

      {!myVote && !state.revealed && (
        <div className="flex justify-center gap-2" data-testid="cv-stars">
          {Array.from({ length: maxScore }, (_, i) => i + 1).map((score) => (
            <button
              key={score}
              onClick={() => handleVote(score)}
              data-testid={`cv-star-${score}`}
              className="p-1 hover:scale-125 transition-transform"
              aria-label={`${score} 星`}
            >
              <Star className="w-8 h-8 text-amber-400 hover:fill-amber-400 transition-colors" />
            </button>
          ))}
        </div>
      )}

      {myVote && (
        <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-200" data-testid="cv-my-vote">
          你的信心：{Array.from({ length: myVote.score }, (_, i) => (
            <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400 inline" />
          ))}
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-3" data-testid="cv-result">
          <div className="text-center">
            <p className="text-3xl font-bold text-amber-500" data-testid="cv-avg">
              {avg.toFixed(1)} / {maxScore}
            </p>
            <p className="text-sm text-muted-foreground">團隊平均信心</p>
          </div>
          <div className="flex flex-col gap-2">
            {Array.from({ length: maxScore }, (_, i) => maxScore - i).map((score) => (
              <div key={score} className="flex items-center gap-2" data-testid={`cv-dist-${score}`}>
                <span className="text-sm font-medium w-6">{score}★</span>
                <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-amber-400 h-4 rounded-full transition-all"
                    style={{ width: total > 0 ? `${(dist[score] / total) * 100}%` : "0%" }}
                  />
                </div>
                <span className="text-sm w-6 text-right">{dist[score]}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        isTeamLead && myVote && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="cv-reveal-btn">
            公布信心結果
          </Button>
        )
      )}
    </div>
  );
}

export default ConfidenceVote;
