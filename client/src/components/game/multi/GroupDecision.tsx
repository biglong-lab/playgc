import { Button } from "@/components/ui/button";

export interface DecisionVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  choice: string;
}

export interface GroupDecisionConfig extends Record<string, unknown> {
  title: string;
  question: string;
  options: string[];
}

export interface GroupDecisionState extends Record<string, unknown> {
  votes: DecisionVote[];
  revealed: boolean;
}

interface GroupDecisionProps {
  config: GroupDecisionConfig;
  state: GroupDecisionState;
  myUserId: string;
  onVote: (choice: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: GroupDecisionConfig = {
  title: "群體決策",
  question: "你選哪個？",
  options: ["選項 A", "選項 B", "選項 C"],
};

function extractConfig(raw: unknown): GroupDecisionConfig {
  const r = raw as Record<string, unknown>;
  if (r && "question" in r && "options" in r && Array.isArray(r.options)) return r as unknown as GroupDecisionConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("question" in c && "options" in c && Array.isArray(c.options)) return c as unknown as GroupDecisionConfig;
  }
  return DEFAULT_CONFIG;
}

function tallyVotes(votes: DecisionVote[], options: string[]) {
  return options.map((opt) => ({ option: opt, count: votes.filter((v) => v.choice === opt).length }));
}

export default function GroupDecision({ config: rawConfig, state, myUserId, onVote, onReveal }: GroupDecisionProps) {
  const config = extractConfig(rawConfig as unknown);
  const myVote = state.votes.find((v) => v.userId === myUserId);
  const tally = tallyVotes(state.votes, config.options);
  const maxCount = Math.max(1, ...tally.map((t) => t.count));

  if (state.revealed) {
    const winner = tally.reduce((a, b) => (b.count > a.count ? b : a), tally[0]);
    return (
      <div className="p-4 space-y-4" data-testid="gd-result">
        <h2 className="text-xl font-bold" data-testid="gd-title">{config.title}</h2>
        <p className="text-sm font-medium" data-testid="gd-question">{config.question}</p>
        {state.votes.length === 0 ? (
          <p className="text-muted-foreground" data-testid="gd-empty">沒有人投票</p>
        ) : (
          <>
            {tally.map((t, idx) => (
              <div key={idx} className="space-y-1" data-testid={`gd-tally-${idx}`}>
                <div className="flex justify-between text-sm">
                  <span>{t.option}</span>
                  <span>{t.count} 票</span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(t.count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {winner && winner.count > 0 && (
              <div className="p-3 border-2 border-primary rounded text-center" data-testid="gd-winner">
                🏆 勝出：<strong>{winner.option}</strong>（{winner.count} 票）
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="gd-title">{config.title}</h2>
      <p className="text-sm font-medium" data-testid="gd-question">{config.question}</p>
      <p className="text-sm text-muted-foreground" data-testid="gd-count">已投票：{state.votes.length} 人</p>

      {myVote ? (
        <div className="p-3 rounded bg-muted text-sm" data-testid="gd-my-vote">
          你選了：<strong>{myVote.choice}</strong>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {config.options.map((opt, idx) => (
            <Button
              key={idx}
              variant="outline"
              onClick={() => onVote(opt)}
              data-testid={`gd-option-${idx}`}
            >
              {opt}
            </Button>
          ))}
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="gd-reveal-btn">
        公布結果
      </Button>
    </div>
  );
}
