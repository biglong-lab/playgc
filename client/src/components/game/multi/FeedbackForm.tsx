import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface FeedbackScore extends Record<string, unknown> {
  scoreId: string;
  userId: string;
  userName: string;
  scores: Record<string, number>;
}

export interface FeedbackFormConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  dimensions: string[];
}

export interface FeedbackFormState extends Record<string, unknown> {
  scores: FeedbackScore[];
  revealed: boolean;
}

interface FeedbackFormProps {
  config: FeedbackFormConfig;
  state: FeedbackFormState;
  myUserId: string;
  onSubmit: (scores: Record<string, number>) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: FeedbackFormConfig = {
  title: "回饋單",
  prompt: "請對以下各項進行評分",
  dimensions: ["內容", "講師", "環境"],
};

function extractConfig(raw: unknown): FeedbackFormConfig {
  const r = raw as Record<string, unknown>;
  if (r && "dimensions" in r && Array.isArray(r.dimensions)) return r as unknown as FeedbackFormConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("dimensions" in c && Array.isArray(c.dimensions)) return c as unknown as FeedbackFormConfig;
  }
  return DEFAULT_CONFIG;
}

const STARS = [1, 2, 3, 4, 5];

export default function FeedbackForm({ config: rawConfig, state, myUserId, onSubmit, onReveal }: FeedbackFormProps) {
  const config = extractConfig(rawConfig as unknown);
  const [localScores, setLocalScores] = useState<Record<string, number>>({});

  const myScore = state.scores.find((s) => s.userId === myUserId);
  const allFilled = config.dimensions.every((d) => localScores[d] !== undefined);

  function handleScore(dim: string, val: number) {
    setLocalScores((prev) => ({ ...prev, [dim]: val }));
  }

  function handleSubmit() {
    if (!allFilled) return;
    onSubmit(localScores);
  }

  function avgForDim(dim: string): string {
    const vals = state.scores.map((s) => s.scores[dim]).filter((v) => typeof v === "number");
    if (vals.length === 0) return "—";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="fb-result">
        <h2 className="text-xl font-bold" data-testid="fb-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="fb-count">共 {state.scores.length} 份回饋</p>
        {state.scores.length === 0 ? (
          <p className="text-muted-foreground" data-testid="fb-empty">還沒有人提交回饋</p>
        ) : (
          <div className="space-y-3">
            {config.dimensions.map((dim, idx) => (
              <div key={idx} data-testid={`fb-avg-${idx}`}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{dim}</span>
                  <span className="font-bold">{avgForDim(dim)} / 5</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${(parseFloat(avgForDim(dim)) / 5) * 100}%` }}
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
      <h2 className="text-xl font-bold" data-testid="fb-title">{config.title}</h2>
      <p className="text-sm" data-testid="fb-prompt">{config.prompt}</p>
      <p className="text-sm text-muted-foreground" data-testid="fb-count">已提交：{state.scores.length} 人</p>

      {myScore ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="fb-my-scores">
          <p className="text-sm">✅ 你已提交回饋</p>
          {config.dimensions.map((dim, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">{dim}：{myScore.scores[dim] ?? "—"} 分</p>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {config.dimensions.map((dim, idx) => (
            <div key={idx}>
              <p className="text-sm font-medium mb-2" data-testid={`fb-dim-${idx}`}>{dim}</p>
              <div className="flex gap-2">
                {STARS.map((star) => (
                  <button
                    key={star}
                    className={`w-10 h-10 rounded border text-lg ${localScores[dim] === star ? "bg-primary text-primary-foreground" : "bg-background"}`}
                    onClick={() => handleScore(dim, star)}
                    data-testid={`fb-score-${idx}-${star}`}
                  >
                    {star}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Button disabled={!allFilled} onClick={handleSubmit} data-testid="fb-submit-btn">
            提交回饋
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="fb-reveal-btn">
        公布結果
      </Button>
    </div>
  );
}
