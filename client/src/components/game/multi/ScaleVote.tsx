import { useState } from "react";
import { SlidersHorizontal, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface ScaleVoteEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  value: number;
}

export interface ScaleVoteConfig extends Record<string, unknown> {
  title: string;
  question: string;
  minLabel: string;
  maxLabel: string;
  scaleMin: number;
  scaleMax: number;
  defaultValue: number;
}

export interface ScaleVoteState extends Record<string, unknown> {
  entries: ScaleVoteEntry[];
  revealed: boolean;
}

interface Props {
  config: ScaleVoteConfig;
  state: ScaleVoteState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (value: number) => void;
  onReveal: () => void;
}

function avg(entries: ScaleVoteEntry[]): number {
  if (entries.length === 0) return 0;
  return Math.round(entries.reduce((s, e) => s + e.value, 0) / entries.length);
}

function pct(value: number, min: number, max: number): number {
  return Math.round(((value - min) / (max - min)) * 100);
}

// ── 元件 ──────────────────────────────────────────────
export function ScaleVote({
  config,
  state,
  userId,
  isTeamLead,
  onSubmit,
  onReveal,
}: Props) {
  const [value, setValue] = useState<number>(config.defaultValue ?? Math.floor((config.scaleMin + config.scaleMax) / 2));

  const myEntry = state.entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;

  const average = avg(state.entries);
  const distribution = state.entries.reduce<Record<number, number>>((acc, e) => {
    acc[e.value] = (acc[e.value] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <SlidersHorizontal className="h-5 w-5 text-blue-500" />
        <h3 className="font-bold text-lg" data-testid="sv-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="sv-question">
        {config.question}
      </p>

      <Badge variant="outline" data-testid="sv-count">
        {state.entries.length} 人已投票
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-4 border rounded-lg p-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{config.minLabel}</span>
            <span className="font-bold text-base text-foreground">{value}</span>
            <span>{config.maxLabel}</span>
          </div>
          <input
            type="range"
            min={config.scaleMin}
            max={config.scaleMax}
            step={1}
            value={value}
            onChange={(e) => setValue(Number(e.target.value))}
            data-testid="sv-slider"
            className="w-full accent-blue-500"
          />
          <Button
            onClick={() => onSubmit(value)}
            className="w-full"
            data-testid="sv-submit-btn"
          >
            提交 {value} 分
          </Button>
        </div>
      )}

      {hasSubmitted && (
        <div
          className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20"
          data-testid="sv-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的投票</p>
          <p className="font-bold text-2xl">{myEntry!.value}</p>
          <p className="text-xs text-muted-foreground">等待揭曉結果...</p>
        </div>
      )}

      {!state.revealed && state.entries.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="sv-empty"
        >
          還沒有人投票
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="sv-result">
          <div className="flex items-center gap-4 border rounded-lg p-3">
            <div>
              <p className="text-xs text-muted-foreground">平均分數</p>
              <p className="font-bold text-3xl" data-testid="sv-average">
                {average}
              </p>
            </div>
            <div className="flex-1 text-right">
              <p className="text-xs text-muted-foreground">
                {config.minLabel} → {config.maxLabel}
              </p>
              <p className="text-sm">{state.entries.length} 人投票</p>
            </div>
          </div>

          {state.entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4" data-testid="sv-empty">
              沒有投票資料
            </p>
          )}

          <div className="space-y-1">
            <p className="text-sm font-medium flex items-center gap-1">
              <BarChart2 className="h-4 w-4" />
              分佈
            </p>
            {Object.entries(distribution)
              .sort(([a], [b]) => Number(b) - Number(a))
              .map(([v, count]) => (
                <div
                  key={v}
                  className="flex items-center gap-2 text-sm"
                  data-testid={`sv-dist-${v}`}
                >
                  <span className="w-8 text-right font-medium">{v}</span>
                  <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all"
                      style={{ width: `${pct(count, 0, state.entries.length)}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-6">{count}</span>
                </div>
              ))}
          </div>

          <div className="space-y-1">
            {state.entries.map((e) => (
              <div
                key={e.entryId}
                className="flex items-center justify-between text-sm border-b pb-1"
                data-testid={`sv-entry-${e.entryId}`}
              >
                <span className="text-muted-foreground">{e.userName}</span>
                <span className="font-medium">{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isTeamLead && !state.revealed && state.entries.length > 0 && (
        <Button
          onClick={onReveal}
          className="w-full"
          data-testid="sv-reveal-btn"
        >
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default ScaleVote;
