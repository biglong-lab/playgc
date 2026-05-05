// 🗳️ MultiVote — 多人即時投票元件（純 UI）
// 所有玩家投票，即時看到各選項得票率，投後可看結果
// 適用：園遊會票選、最佳表現投票、問卷調查、企業決策

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Vote, Users } from "lucide-react";

export interface VoteOption {
  id: string;
  label: string;
  emoji?: string;
}

export interface MultiVoteConfig {
  title?: string;
  question: string;
  options: VoteOption[];
  allowMultiple?: boolean;
  showResultsAfterVote?: boolean;
  showVoterCount?: boolean;
}

export interface VoteRecord {
  userId: string;
  userName: string;
  optionIds: string[];
  votedAt: number;
}

export interface MultiVoteState extends Record<string, unknown> {
  votes: VoteRecord[];
}

interface MultiVoteProps {
  config: MultiVoteConfig;
  state: MultiVoteState;
  myUserId: string;
  onVote: (optionIds: string[]) => Promise<void>;
}

function getVoteCount(votes: VoteRecord[], optionId: string): number {
  return votes.filter((v) => v.optionIds.includes(optionId)).length;
}

export default function MultiVote({ config, state, myUserId, onVote }: MultiVoteProps) {
  const myVote = state.votes.find((v) => v.userId === myUserId);
  const hasVoted = !!myVote;
  const totalVoters = state.votes.length;
  const showResults = hasVoted && config.showResultsAfterVote !== false;

  const handleVote = (optionId: string) => {
    if (hasVoted) return;
    void onVote([optionId]);
  };

  const maxCount = Math.max(...config.options.map((o) => getVoteCount(state.votes, o.id)), 1);

  return (
    <div className="space-y-4" data-testid="multi-vote-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="multi-vote-title">
              <Vote className="w-5 h-5 text-blue-500" />
              {config.title ?? "🗳️ 投票"}
            </CardTitle>
            {(config.showVoterCount !== false) && totalVoters > 0 && (
              <Badge variant="outline" data-testid="vote-voter-count">
                <Users className="w-3 h-3 mr-1" />
                {totalVoters} 票
              </Badge>
            )}
          </div>
          <p className="text-sm font-medium text-foreground pt-1" data-testid="multi-vote-question">
            {config.question}
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {hasVoted && (
            <p className="text-xs text-green-600 font-medium text-center pb-1" data-testid="vote-submitted-msg">
              ✅ 已投票
            </p>
          )}
          {config.options.map((option) => {
            const count = getVoteCount(state.votes, option.id);
            const pct = totalVoters > 0 ? Math.round((count / totalVoters) * 100) : 0;
            const isMyChoice = myVote?.optionIds.includes(option.id);
            const isWinner = showResults && count === maxCount && count > 0;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => handleVote(option.id)}
                disabled={hasVoted}
                data-testid={`vote-option-${option.id}`}
                className={`w-full text-left rounded-xl border transition-all overflow-hidden ${
                  isMyChoice
                    ? "border-blue-400 bg-blue-50"
                    : isWinner
                    ? "border-amber-400 bg-amber-50/50"
                    : "border-border hover:border-blue-300 hover:bg-muted/50"
                } ${hasVoted ? "cursor-default" : "cursor-pointer"}`}
              >
                <div className="flex items-center gap-3 px-3 py-2.5">
                  {option.emoji && <span className="text-xl shrink-0">{option.emoji}</span>}
                  <span className="flex-1 text-sm font-medium">{option.label}</span>
                  {showResults && (
                    <span className="text-xs text-muted-foreground shrink-0" data-testid={`vote-pct-${option.id}`}>
                      {pct}%
                    </span>
                  )}
                  {isMyChoice && <span className="text-xs text-blue-600 shrink-0">✓ 你的票</span>}
                </div>
                {showResults && (
                  <div className="h-1.5 bg-muted mx-3 mb-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${
                        isWinner ? "bg-amber-400" : "bg-blue-400"
                      }`}
                      style={{ width: `${pct}%` }}
                      data-testid={`vote-bar-${option.id}`}
                    />
                  </div>
                )}
              </button>
            );
          })}

          {!hasVoted && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              點選一個選項投票
            </p>
          )}
        </CardContent>
      </Card>

      {showResults && (
        <p className="text-xs text-muted-foreground text-center" data-testid="vote-results-note">
          共 {totalVoters} 人投票 · 即時結果
        </p>
      )}
    </div>
  );
}
