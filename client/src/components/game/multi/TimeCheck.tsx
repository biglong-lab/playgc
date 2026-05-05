import { Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface TimeCheckEntry extends Record<string, unknown> {
  checkId: string;
  userId: string;
  userName: string;
  milestoneIndex: number;
}

export interface TimeCheckConfig extends Record<string, unknown> {
  title: string;
  question: string;
  milestones: string[];
}

export interface TimeCheckState extends Record<string, unknown> {
  checks: TimeCheckEntry[];
  revealed: boolean;
}

interface Props {
  config: TimeCheckConfig;
  state: TimeCheckState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (milestoneIndex: number) => void;
  onReveal: () => void;
}

// ── 元件 ──────────────────────────────────────────────
export function TimeCheck({ config, state, userId, isTeamLead, onSubmit, onReveal }: Props) {
  const myEntry = state.checks.find((c) => c.userId === userId);
  const hasSubmitted = !!myEntry;

  const tally = config.milestones.map((_, i) =>
    state.checks.filter((c) => c.milestoneIndex === i).length,
  );
  const maxCount = Math.max(...tally, 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5 text-teal-500" />
        <h3 className="font-bold text-lg" data-testid="tc-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="tc-question">
        {config.question}
      </p>

      <Badge variant="outline" data-testid="tc-count">
        {state.checks.length} 人已回報
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-2 border rounded-lg p-4" data-testid="tc-milestone-list">
          {config.milestones.map((milestone, i) => (
            <button
              key={i}
              onClick={() => onSubmit(i)}
              data-testid={`tc-milestone-${i}`}
              className="w-full text-left border rounded-lg p-3 text-sm hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors flex items-center gap-2"
            >
              <span className="w-5 h-5 rounded-full border-2 border-teal-400 flex items-center justify-center text-xs font-bold text-teal-600">
                {i + 1}
              </span>
              {milestone}
            </button>
          ))}
        </div>
      )}

      {hasSubmitted && !state.revealed && (
        <div
          className="border rounded-lg p-3 bg-teal-50 dark:bg-teal-900/20"
          data-testid="tc-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的位置</p>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-teal-500" />
            <span className="font-medium">
              {config.milestones[myEntry!.milestoneIndex]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">等待揭曉結果...</p>
        </div>
      )}

      {!state.revealed && state.checks.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="tc-empty"
        >
          還沒有人回報
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="tc-result">
          {state.checks.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="tc-empty"
            >
              沒有回報資料
            </p>
          )}
          {config.milestones.map((milestone, i) => {
            const count = tally[i];
            const entries = state.checks.filter((c) => c.milestoneIndex === i);
            return (
              <div key={i} data-testid={`tc-tally-${i}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{milestone}</span>
                  <Badge variant="secondary">{count} 人</Badge>
                </div>
                <div className="bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-teal-500 h-3 rounded-full transition-all"
                    style={{ width: `${Math.round((count / maxCount) * 100)}%` }}
                  />
                </div>
                {entries.map((e) => (
                  <span
                    key={e.checkId}
                    className="text-xs text-muted-foreground mr-1"
                    data-testid={`tc-entry-${e.checkId}`}
                  >
                    {e.userName}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {isTeamLead && !state.revealed && state.checks.length > 0 && (
        <Button onClick={onReveal} className="w-full" data-testid="tc-reveal-btn">
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default TimeCheck;
