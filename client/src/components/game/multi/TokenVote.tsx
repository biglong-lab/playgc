import { useState } from "react";
import { Coins, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface TokenDistribution extends Record<string, unknown> {
  distId: string;
  userId: string;
  userName: string;
  distribution: number[];
}

export interface TokenVoteConfig extends Record<string, unknown> {
  title: string;
  question: string;
  options: string[];
  totalTokens: number;
}

export interface TokenVoteState extends Record<string, unknown> {
  votes: TokenDistribution[];
  revealed: boolean;
}

interface Props {
  config: TokenVoteConfig;
  state: TokenVoteState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (distribution: number[]) => void;
  onReveal: () => void;
}

function totalPerOption(votes: TokenDistribution[]): number[] {
  if (votes.length === 0) return [];
  const len = votes[0].distribution.length;
  return Array.from({ length: len }, (_, i) =>
    votes.reduce((sum, v) => sum + (v.distribution[i] ?? 0), 0),
  );
}

// ── 元件 ──────────────────────────────────────────────
export function TokenVote({ config, state, userId, isTeamLead, onSubmit, onReveal }: Props) {
  const [dist, setDist] = useState<number[]>(config.options.map(() => 0));

  const myEntry = state.votes.find((v) => v.userId === userId);
  const hasSubmitted = !!myEntry;
  const usedTokens = dist.reduce((s, n) => s + n, 0);
  const remaining = config.totalTokens - usedTokens;
  const canSubmit = remaining === 0;

  const totals = state.revealed ? totalPerOption(state.votes) : [];
  const maxTotal = Math.max(...totals, 1);

  function adjust(index: number, delta: number) {
    setDist((prev) => {
      const next = [...prev];
      const newVal = next[index] + delta;
      if (newVal < 0) return prev;
      if (delta > 0 && remaining <= 0) return prev;
      next[index] = newVal;
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Coins className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg" data-testid="tv-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="tv-question">
        {config.question}
      </p>

      <div className="flex items-center gap-2">
        <Badge variant="outline" data-testid="tv-count">
          {state.votes.length} 人已投票
        </Badge>
        <Badge
          variant={remaining === 0 ? "default" : "secondary"}
          data-testid="tv-remaining"
        >
          剩 {remaining} 代幣
        </Badge>
      </div>

      {!hasSubmitted && (
        <div className="space-y-3 border rounded-lg p-4">
          <p className="text-xs text-muted-foreground">
            共 {config.totalTokens} 枚代幣，分配給你認為最重要的選項
          </p>
          {config.options.map((opt, i) => (
            <div
              key={opt}
              className="flex items-center gap-2"
              data-testid={`tv-option-${i}`}
            >
              <span className="flex-1 text-sm">{opt}</span>
              <button
                onClick={() => adjust(i, -1)}
                disabled={dist[i] <= 0}
                className="w-7 h-7 rounded border text-sm font-bold disabled:opacity-40 hover:bg-muted"
                data-testid={`tv-minus-${i}`}
              >
                −
              </button>
              <span className="w-8 text-center font-bold text-sm" data-testid={`tv-val-${i}`}>
                {dist[i]}
              </span>
              <button
                onClick={() => adjust(i, 1)}
                disabled={remaining <= 0}
                className="w-7 h-7 rounded border text-sm font-bold disabled:opacity-40 hover:bg-muted"
                data-testid={`tv-plus-${i}`}
              >
                +
              </button>
            </div>
          ))}
          <Button
            onClick={() => onSubmit(dist)}
            disabled={!canSubmit}
            className="w-full"
            data-testid="tv-submit-btn"
          >
            {canSubmit ? "提交分配" : `還剩 ${remaining} 枚代幣未分配`}
          </Button>
        </div>
      )}

      {hasSubmitted && !state.revealed && (
        <div
          className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20"
          data-testid="tv-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的分配</p>
          {config.options.map((opt, i) => (
            <div key={opt} className="flex justify-between text-sm">
              <span>{opt}</span>
              <span className="font-bold">{myEntry!.distribution[i]} 枚</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">等待揭曉結果...</p>
        </div>
      )}

      {!state.revealed && state.votes.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="tv-empty"
        >
          還沒有人投票
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="tv-result">
          <div className="flex items-center gap-1 text-sm font-medium">
            <BarChart2 className="h-4 w-4" />
            代幣分配總計
          </div>

          {state.votes.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="tv-empty"
            >
              沒有投票資料
            </p>
          )}

          {config.options.map((opt, i) => {
            const total = totals[i] ?? 0;
            const pct = Math.round((total / maxTotal) * 100);
            return (
              <div key={opt} data-testid={`tv-result-${i}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{opt}</span>
                  <span className="font-bold text-yellow-600">{total} 枚</span>
                </div>
                <div className="bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-yellow-500 h-3 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isTeamLead && !state.revealed && state.votes.length > 0 && (
        <Button onClick={onReveal} className="w-full" data-testid="tv-reveal-btn">
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default TokenVote;
