import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface MultiChoiceVote extends Record<string, unknown> {
  voteId: string;
  userId: string;
  userName: string;
  choices: number[];
}

export interface CheckboxVoteConfig extends Record<string, unknown> {
  title: string;
  question: string;
  options: string[];
  maxChoices: number;
}

export interface CheckboxVoteState extends Record<string, unknown> {
  votes: MultiChoiceVote[];
  revealed: boolean;
}

interface CheckboxVoteProps {
  config: CheckboxVoteConfig;
  state: CheckboxVoteState;
  myUserId: string;
  onVote: (choices: number[]) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: CheckboxVoteConfig = {
  title: "☑️ 複選投票",
  question: "請選擇所有符合的選項",
  options: ["選項 A", "選項 B", "選項 C"],
  maxChoices: 3,
};

function extractConfig(raw: unknown): CheckboxVoteConfig {
  const r = raw as Record<string, unknown>;
  if (r && "maxChoices" in r && typeof r.maxChoices === "number") return r as unknown as CheckboxVoteConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("maxChoices" in c && typeof c.maxChoices === "number") return c as unknown as CheckboxVoteConfig;
  }
  return DEFAULT_CONFIG;
}

export default function CheckboxVote({ config: rawConfig, state, myUserId, onVote, onReveal }: CheckboxVoteProps) {
  const config = extractConfig(rawConfig as unknown);
  const [selected, setSelected] = useState<number[]>([]);

  const myVote = state.votes.find((v) => v.userId === myUserId);
  const canVote = selected.length > 0;

  function toggleChoice(idx: number) {
    if (selected.includes(idx)) {
      setSelected(selected.filter((i) => i !== idx));
    } else if (selected.length < config.maxChoices) {
      setSelected([...selected, idx]);
    }
  }

  function handleVote() {
    if (!canVote) return;
    onVote(selected);
  }

  if (state.revealed) {
    const tallies = config.options.map((_, i) =>
      state.votes.filter((v) => v.choices.includes(i)).length,
    );
    const maxTally = Math.max(...tallies, 1);

    return (
      <div className="p-4 space-y-4" data-testid="cbv-result">
        <h2 className="text-xl font-bold" data-testid="cbv-title">{config.title}</h2>
        <p className="text-sm font-medium" data-testid="cbv-question">{config.question}</p>
        <p className="text-xs text-muted-foreground" data-testid="cbv-count">共 {state.votes.length} 人投票</p>
        {state.votes.length === 0 ? (
          <p className="text-muted-foreground" data-testid="cbv-empty">還沒有人投票</p>
        ) : (
          <div className="space-y-3">
            {config.options.map((opt, idx) => (
              <div key={idx} className="space-y-1" data-testid={`cbv-tally-${idx}`}>
                <div className="flex justify-between text-sm">
                  <span>{opt}</span>
                  <span className="font-semibold">{tallies[idx]} 票</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${(tallies[idx] / maxTally) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="cbv-title">{config.title}</h2>
      <p className="text-sm font-medium" data-testid="cbv-question">{config.question}</p>
      <p className="text-xs text-muted-foreground">
        可選 {config.maxChoices} 項，已選 {selected.length}/{config.maxChoices}
      </p>
      <p className="text-xs text-muted-foreground" data-testid="cbv-count">已投票：{state.votes.length} 人</p>

      {myVote ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="cbv-my-vote">
          <p className="text-sm font-medium mb-1">✅ 你已投票（{myVote.choices.length} 項）</p>
          {myVote.choices.map((c) => (
            <p key={c} className="text-xs text-muted-foreground">☑ {config.options[c]}</p>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {config.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-3" data-testid={`cbv-option-${idx}`}>
              <Checkbox
                id={`cbv-opt-${idx}`}
                checked={selected.includes(idx)}
                onCheckedChange={() => toggleChoice(idx)}
                disabled={!selected.includes(idx) && selected.length >= config.maxChoices}
              />
              <label htmlFor={`cbv-opt-${idx}`} className="text-sm cursor-pointer">{opt}</label>
            </div>
          ))}
          <Button disabled={!canVote} onClick={handleVote} data-testid="cbv-vote-btn">
            提交投票
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="cbv-reveal-btn">
        公布投票結果
      </Button>
    </div>
  );
}
