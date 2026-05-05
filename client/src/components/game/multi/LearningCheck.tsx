import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface LearningCheckEntry extends Record<string, unknown> {
  checkId: string;
  userId: string;
  userName: string;
  ratings: Record<string, number>;
  note: string;
}

export interface LearningCheckConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  topics: string[];
  selfRateLabel: string;
  maxLength: number;
}

export interface LearningCheckState extends Record<string, unknown> {
  checks: LearningCheckEntry[];
  revealed: boolean;
}

interface LearningCheckProps {
  config: LearningCheckConfig;
  state: LearningCheckState;
  userId: string;
  onSubmit: (ratings: Record<string, number>, note: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: LearningCheckConfig = {
  title: "📊 學習確認",
  prompt: "對今天學到的主題，評估自己的掌握程度",
  topics: ["概念理解", "實作能力", "應用情境"],
  selfRateLabel: "掌握度 1-5",
  maxLength: 100,
};

const RATING_EMOJIS = ["", "😓", "🤔", "😊", "💪", "⭐"];

function extractConfig(raw: unknown): LearningCheckConfig {
  const r = raw as Record<string, unknown>;
  if (r && "selfRateLabel" in r && typeof r.selfRateLabel === "string") return r as unknown as LearningCheckConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("selfRateLabel" in c && typeof c.selfRateLabel === "string") return c as unknown as LearningCheckConfig;
  }
  return DEFAULT_CONFIG;
}

export function LearningCheck({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: LearningCheckProps) {
  const config = extractConfig(rawConfig as unknown);
  const initRatings: Record<string, number> = {};
  for (const t of config.topics) initRatings[t] = 0;
  const [ratings, setRatings] = useState<Record<string, number>>(initRatings);
  const [note, setNote] = useState("");

  const myEntry = state.checks.find((c: LearningCheckEntry) => c.userId === userId);
  const canSubmit = config.topics.every((t) => (ratings[t] ?? 0) > 0);

  function setRating(topic: string, val: number) {
    setRatings({ ...ratings, [topic]: val });
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(ratings, note.trim());
  }

  if (state.revealed) {
    const avgByTopic: Record<string, number> = {};
    for (const topic of config.topics) {
      const vals = state.checks.map((c: LearningCheckEntry) => c.ratings[topic] ?? 0).filter((v) => v > 0);
      avgByTopic[topic] = vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0;
    }

    return (
      <div className="p-4 space-y-4" data-testid="lc-result">
        <h2 className="text-xl font-bold" data-testid="lc-title">{config.title}</h2>
        <p className="text-xs text-muted-foreground" data-testid="lc-count">共 {state.checks.length} 人填寫</p>
        {state.checks.length === 0 ? (
          <p className="text-muted-foreground" data-testid="lc-empty">還沒有人填寫</p>
        ) : (
          <div className="space-y-3">
            {config.topics.map((topic) => (
              <div key={topic} className="p-3 border rounded-lg bg-blue-50/30" data-testid={`lc-avg-${topic}`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium">{topic}</p>
                  <span className="text-sm font-bold text-blue-700">
                    {RATING_EMOJIS[Math.round(avgByTopic[topic])] ?? ""} {avgByTopic[topic]}/5
                  </span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${(avgByTopic[topic] / 5) * 100}%` }}
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
      <h2 className="text-xl font-bold" data-testid="lc-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="lc-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="lc-count">已填寫：{state.checks.length} 人</p>
      {state.checks.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="lc-empty">
          還沒有人填寫，快來第一個！
        </p>
      )}

      {myEntry ? (
        <div className="p-3 border rounded bg-blue-50/30" data-testid="lc-my-entry">
          <p className="text-sm font-medium mb-2">📊 你的學習確認已送出</p>
          {config.topics.map((topic) => (
            <div key={topic} className="flex items-center justify-between text-xs text-muted-foreground py-1">
              <span>{topic}</span>
              <span>{RATING_EMOJIS[myEntry.ratings[topic] ?? 0]} {myEntry.ratings[topic] ?? 0}/5</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {config.topics.map((topic) => (
            <div key={topic}>
              <p className="text-sm font-medium mb-2">{topic}</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setRating(topic, val)}
                    className={[
                      "w-10 h-10 rounded-full border-2 text-lg transition-all",
                      ratings[topic] === val
                        ? "border-blue-500 bg-blue-50 scale-110"
                        : "border-gray-200 hover:border-blue-300",
                    ].join(" ")}
                    data-testid={`lc-rate-${topic}-${val}`}
                  >
                    {val}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <Textarea
            placeholder="有什麼想補充的？（可選）"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={config.maxLength}
            rows={2}
            data-testid="lc-note-input"
          />
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="lc-submit-btn">
            送出學習確認
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="lc-reveal-btn">
          公布學習確認結果
        </Button>
      )}
    </div>
  );
}

export default LearningCheck;
