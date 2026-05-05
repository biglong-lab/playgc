import { BarChart2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface PollVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  option: string;
}

export interface QuickPollConfig extends Record<string, unknown> {
  title: string;
  question: string;
  options: string[];
  maxLength: number;
}

export interface QuickPollState extends Record<string, unknown> {
  votes: PollVote[];
  revealed: boolean;
}

interface Props {
  config: QuickPollConfig;
  state: QuickPollState;
  userId: string;
  isTeamLead?: boolean;
  onVote: (option: string) => void;
  onReveal: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function QuickPoll({
  config,
  state,
  userId,
  isTeamLead,
  onVote,
  onReveal,
}: Props) {
  const myVote = state.votes.find((v) => v.userId === userId);
  const hasVoted = !!myVote;

  const tally = config.options.reduce<Record<string, number>>((acc, opt) => {
    acc[opt] = state.votes.filter((v) => v.option === opt).length;
    return acc;
  }, {});

  const maxVotes = Math.max(...Object.values(tally), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-lg" data-testid="qp-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="qp-question">
        {config.question}
      </p>

      <Badge variant="outline" data-testid="qp-count">
        {state.votes.length} 票
      </Badge>

      {!hasVoted && (
        <div className="space-y-2">
          {config.options.map((opt) => (
            <Button
              key={opt}
              variant="outline"
              className="w-full justify-start"
              onClick={() => onVote(opt)}
              data-testid={`qp-option-${opt}`}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      {hasVoted && !state.revealed && (
        <div className="space-y-2">
          {config.options.map((opt) => (
            <div
              key={opt}
              className={`border rounded-lg p-3 flex items-center gap-2 ${myVote!.option === opt ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20" : ""}`}
              data-testid={`qp-option-voted-${opt}`}
            >
              {myVote!.option === opt && (
                <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />
              )}
              <span className="text-sm">{opt}</span>
              {myVote!.option === opt && (
                <span data-testid="qp-my-vote" className="text-xs text-muted-foreground ml-auto">
                  我的選擇
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {!state.revealed && state.votes.length === 0 && !hasVoted && (
        <p className="text-sm text-muted-foreground text-center py-2" data-testid="qp-empty">
          還沒有人投票
        </p>
      )}

      {state.revealed && (
        <div className="space-y-2" data-testid="qp-result">
          <p className="text-sm font-semibold">投票結果</p>
          {state.votes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="qp-empty">
              沒有投票資料
            </p>
          )}
          {config.options.map((opt) => {
            const count = tally[opt] ?? 0;
            const pct = Math.round((count / state.votes.length) * 100) || 0;
            return (
              <div key={opt} className="space-y-1" data-testid={`qp-tally-${opt}`}>
                <div className="flex justify-between text-sm">
                  <span>{opt}</span>
                  <span className="font-medium">{count} 票（{pct}%）</span>
                </div>
                <div className="bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.round((count / maxVotes) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isTeamLead && !state.revealed && state.votes.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="qp-reveal-btn"
        >
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default QuickPoll;
