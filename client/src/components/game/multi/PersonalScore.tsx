import { useState } from "react";
import { BarChart2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface ScoreEntry extends Record<string, unknown> {
  scoreId: string;
  userId: string;
  userName: string;
  ratings: number[];
}

export interface PersonalScoreConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  criteria: string[];
  maxScore: number;
}

export interface PersonalScoreState extends Record<string, unknown> {
  scores: ScoreEntry[];
  revealed: boolean;
}

interface Props {
  config: PersonalScoreConfig;
  state: PersonalScoreState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (ratings: number[]) => void;
  onReveal: () => void;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function criteriaAverage(scores: ScoreEntry[], index: number): number {
  return average(scores.map((s) => s.ratings[index] ?? 0));
}

// ── 元件 ──────────────────────────────────────────────
export function PersonalScore({ config, state, userId, isTeamLead, onSubmit, onReveal }: Props) {
  const [ratings, setRatings] = useState<number[]>(
    config.criteria.map(() => Math.ceil(config.maxScore / 2)),
  );

  const myEntry = state.scores.find((s) => s.userId === userId);
  const hasSubmitted = !!myEntry;

  function setRating(index: number, value: number) {
    setRatings((prev) => prev.map((r, i) => (i === index ? value : r)));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-orange-500" />
        <h3 className="font-bold text-lg" data-testid="ps-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="ps-prompt">
        {config.prompt}
      </p>

      <Badge variant="outline" data-testid="ps-count">
        {state.scores.length} 人已評分
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-3 border rounded-lg p-4">
          {config.criteria.map((criterion, i) => (
            <div key={criterion} className="space-y-1" data-testid={`ps-criterion-${i}`}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{criterion}</span>
                <span className="font-bold text-orange-500">
                  {ratings[i]} / {config.maxScore}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={config.maxScore}
                step={1}
                value={ratings[i]}
                onChange={(e) => setRating(i, Number(e.target.value))}
                data-testid={`ps-slider-${i}`}
                className="w-full accent-orange-500"
              />
            </div>
          ))}
          <Button
            onClick={() => onSubmit(ratings)}
            className="w-full"
            data-testid="ps-submit-btn"
          >
            提交自評
          </Button>
        </div>
      )}

      {hasSubmitted && !state.revealed && (
        <div
          className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-900/20"
          data-testid="ps-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的評分</p>
          {config.criteria.map((criterion, i) => (
            <div key={criterion} className="flex justify-between text-sm">
              <span>{criterion}</span>
              <span className="font-bold">{myEntry!.ratings[i]}</span>
            </div>
          ))}
          <p className="text-xs text-muted-foreground mt-1">等待揭曉結果...</p>
        </div>
      )}

      {!state.revealed && state.scores.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="ps-empty"
        >
          還沒有人評分
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="ps-result">
          <div className="flex items-center gap-1 text-sm font-medium">
            <BarChart2 className="h-4 w-4" />
            團隊平均
          </div>

          {state.scores.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="ps-empty"
            >
              沒有評分資料
            </p>
          )}

          {config.criteria.map((criterion, i) => {
            const avg = criteriaAverage(state.scores, i);
            const pct = Math.round((avg / config.maxScore) * 100);
            return (
              <div key={criterion} data-testid={`ps-avg-${i}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{criterion}</span>
                  <span className="font-bold text-orange-500">
                    {avg} / {config.maxScore}
                  </span>
                </div>
                <div className="bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-orange-500 h-3 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}

          <div className="space-y-1 pt-2 border-t">
            {state.scores.map((s) => (
              <div
                key={s.scoreId}
                className="flex items-center gap-2 text-sm"
                data-testid={`ps-entry-${s.scoreId}`}
              >
                <span className="flex-1 text-muted-foreground">{s.userName}</span>
                <span className="text-xs font-medium">
                  avg {average(s.ratings)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && state.scores.length > 0 && (
        <Button onClick={onReveal} className="w-full" data-testid="ps-reveal-btn">
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default PersonalScore;
