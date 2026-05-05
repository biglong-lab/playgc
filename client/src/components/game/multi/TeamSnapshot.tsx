import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SnapshotCard extends Record<string, unknown> {
  cardId: string;
  userId: string;
  userName: string;
  answers: Record<string, string>;
}

export interface TeamSnapshotConfig extends Record<string, unknown> {
  title: string;
  fields: string[];
  maxLength: number;
}

export interface TeamSnapshotState extends Record<string, unknown> {
  cards: SnapshotCard[];
  revealed: boolean;
}

interface TeamSnapshotProps {
  config: TeamSnapshotConfig;
  state: TeamSnapshotState;
  myUserId: string;
  onSubmit: (answers: Record<string, string>) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: TeamSnapshotConfig = {
  title: "團隊快照",
  fields: ["開心的事", "擔心的事", "需要支援"],
  maxLength: 50,
};

function extractConfig(raw: unknown): TeamSnapshotConfig {
  const r = raw as Record<string, unknown>;
  if (r && "fields" in r && Array.isArray(r.fields)) return r as unknown as TeamSnapshotConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("fields" in c && Array.isArray(c.fields)) return c as unknown as TeamSnapshotConfig;
  }
  return DEFAULT_CONFIG;
}

export default function TeamSnapshot({ config: rawConfig, state, myUserId, onSubmit, onReveal }: TeamSnapshotProps) {
  const config = extractConfig(rawConfig as unknown);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const myCard = state.cards.find((c) => c.userId === myUserId);
  const allFilled = config.fields.every((f) => answers[f]?.trim());

  function handleChange(field: string, val: string) {
    setAnswers((prev) => ({ ...prev, [field]: val }));
  }

  function handleSubmit() {
    if (!allFilled) return;
    onSubmit(answers);
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="tsn-result">
        <h2 className="text-xl font-bold" data-testid="tsn-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="tsn-count">共 {state.cards.length} 份快照</p>
        {state.cards.length === 0 ? (
          <p className="text-muted-foreground" data-testid="tsn-empty">還沒有人提交快照</p>
        ) : (
          <div className="space-y-3">
            {state.cards.map((card) => (
              <div key={card.cardId} className="p-4 border rounded-lg" data-testid={`tsn-card-${card.cardId}`}>
                <p className="font-semibold mb-2">{card.userName}</p>
                {config.fields.map((field, idx) => (
                  <div key={idx} className="text-sm mb-1">
                    <span className="text-muted-foreground">{field}：</span>
                    <span>{card.answers[field] ?? "—"}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="tsn-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="tsn-count">已提交：{state.cards.length} 人</p>

      {myCard ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="tsn-my-card">
          <p className="text-sm font-medium mb-1">✅ 你已提交快照</p>
          {config.fields.map((field, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">{field}：{myCard.answers[field] ?? "—"}</p>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {config.fields.map((field, idx) => (
            <div key={idx}>
              <p className="text-sm font-medium mb-1" data-testid={`tsn-field-${idx}`}>{field}</p>
              <Input
                placeholder={`填寫「${field}」...`}
                value={answers[field] ?? ""}
                onChange={(e) => handleChange(field, e.target.value)}
                maxLength={config.maxLength}
                data-testid={`tsn-input-${idx}`}
              />
            </div>
          ))}
          <Button disabled={!allFilled} onClick={handleSubmit} data-testid="tsn-submit-btn">
            提交快照
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="tsn-reveal-btn">
        公布所有快照
      </Button>
    </div>
  );
}
