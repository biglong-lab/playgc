import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export interface FutureVision extends Record<string, unknown> {
  visionId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface FutureIdeaConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  horizon: string;
  maxLength: number;
}

export interface FutureIdeaState extends Record<string, unknown> {
  visions: FutureVision[];
  revealed: boolean;
}

interface FutureIdeaProps {
  config: FutureIdeaConfig;
  state: FutureIdeaState;
  userId: string;
  onSubmit: (text: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: FutureIdeaConfig = {
  title: "🔭 未來想像",
  prompt: "想像 5 年後，描述你看到的畫面",
  horizon: "5 年後",
  maxLength: 200,
};

function extractConfig(raw: unknown): FutureIdeaConfig {
  const r = raw as Record<string, unknown>;
  if (r && "horizon" in r && typeof r.horizon === "string") return r as unknown as FutureIdeaConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("horizon" in c && typeof c.horizon === "string") return c as unknown as FutureIdeaConfig;
  }
  return DEFAULT_CONFIG;
}

export function FutureIdea({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: FutureIdeaProps) {
  const config = extractConfig(rawConfig as unknown);
  const [text, setText] = useState("");

  const myVision = state.visions.find((v) => v.userId === userId);
  const canSubmit = text.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(text.trim());
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="fi-result">
        <h2 className="text-xl font-bold" data-testid="fi-title">{config.title}</h2>
        <p className="text-sm font-medium text-primary" data-testid="fi-horizon">{config.horizon}</p>
        <p className="text-xs text-muted-foreground" data-testid="fi-count">共 {state.visions.length} 個願景</p>
        {state.visions.length === 0 ? (
          <p className="text-muted-foreground" data-testid="fi-empty">還沒有人分享未來想像</p>
        ) : (
          <div className="space-y-3">
            {state.visions.map((vision) => (
              <div key={vision.visionId} className="p-4 border rounded-lg bg-indigo-50/30" data-testid={`fi-vision-${vision.visionId}`}>
                <p className="text-xs text-muted-foreground mb-1">{vision.userName} 的未來：</p>
                <p className="text-sm">{vision.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="fi-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="fi-prompt">{config.prompt}</p>
      <p className="text-sm font-medium text-primary" data-testid="fi-horizon">🔭 {config.horizon}</p>
      <p className="text-xs text-muted-foreground" data-testid="fi-count">已分享：{state.visions.length} 人</p>
      {state.visions.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="fi-empty">還沒有人分享未來願景，快來第一個！</p>
      )}

      {myVision ? (
        <div className="p-3 border rounded bg-indigo-50/30" data-testid="fi-my-vision">
          <p className="text-sm font-medium mb-1">🔭 你的未來想像</p>
          <p className="text-xs text-muted-foreground">{myVision.text}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder={`描述你想像中 ${config.horizon} 的樣子...`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={config.maxLength}
            rows={4}
            data-testid="fi-input"
          />
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="fi-submit-btn">
            分享未來想像
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="fi-reveal-btn">
          公布所有未來想像
        </Button>
      )}
    </div>
  );
}

export default FutureIdea;
