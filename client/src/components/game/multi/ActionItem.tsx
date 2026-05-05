import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface ActionEntry extends Record<string, unknown> {
  actionId: string;
  userId: string;
  userName: string;
  text: string;
  timeframe: string;
}

export interface ActionItemConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  timeOptions: string[];
}

export interface ActionItemState extends Record<string, unknown> {
  actions: ActionEntry[];
  revealed: boolean;
}

interface ActionItemProps {
  config: ActionItemConfig;
  state: ActionItemState;
  myUserId: string;
  onSubmit: (text: string, timeframe: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: ActionItemConfig = {
  title: "行動承諾",
  prompt: "完成這次活動後，你打算做什麼？",
  maxLength: 60,
  timeOptions: ["今天", "本週", "本月"],
};

function extractConfig(raw: unknown): ActionItemConfig {
  const r = raw as Record<string, unknown>;
  if (r && "timeOptions" in r && Array.isArray(r.timeOptions)) return r as unknown as ActionItemConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("timeOptions" in c && Array.isArray(c.timeOptions)) return c as unknown as ActionItemConfig;
  }
  return DEFAULT_CONFIG;
}

export default function ActionItem({ config: rawConfig, state, myUserId, onSubmit, onReveal }: ActionItemProps) {
  const config = extractConfig(rawConfig as unknown);
  const [text, setText] = useState("");
  const [timeframe, setTimeframe] = useState(config.timeOptions[0] ?? "今天");

  const myAction = state.actions.find((a) => a.userId === myUserId);

  function handleSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim(), timeframe);
    setText("");
  }

  if (state.revealed) {
    const grouped = config.timeOptions.map((tf) => ({
      timeframe: tf,
      items: state.actions.filter((a) => a.timeframe === tf),
    }));

    return (
      <div className="p-4 space-y-4" data-testid="ai-result">
        <h2 className="text-xl font-bold" data-testid="ai-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="ai-count">共 {state.actions.length} 個承諾</p>
        {state.actions.length === 0 ? (
          <p className="text-muted-foreground" data-testid="ai-empty">還沒有人提交承諾</p>
        ) : (
          <div className="space-y-4">
            {grouped.map((g, idx) => g.items.length > 0 && (
              <div key={idx} data-testid={`ai-group-${idx}`}>
                <p className="font-semibold text-sm mb-2">📅 {g.timeframe}</p>
                <div className="space-y-2">
                  {g.items.map((a) => (
                    <div key={a.actionId} className="p-3 border rounded flex gap-3 items-start" data-testid={`ai-action-${a.actionId}`}>
                      <span className="text-lg">✅</span>
                      <div>
                        <p className="text-sm font-medium">{a.text}</p>
                        <p className="text-xs text-muted-foreground">{a.userName}</p>
                      </div>
                    </div>
                  ))}
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
      <h2 className="text-xl font-bold" data-testid="ai-title">{config.title}</h2>
      <p className="text-sm" data-testid="ai-prompt">{config.prompt}</p>
      <p className="text-sm text-muted-foreground" data-testid="ai-count">已提交：{state.actions.length} 人</p>

      {myAction ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="ai-my-action">
          <p className="text-sm font-medium">✅ {myAction.text}</p>
          <p className="text-xs text-muted-foreground">時間：{myAction.timeframe}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {config.timeOptions.map((tf, idx) => (
              <button
                key={idx}
                className={`px-3 py-1 rounded border text-sm ${timeframe === tf ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setTimeframe(tf)}
                data-testid={`ai-time-${idx}`}
              >
                {tf}
              </button>
            ))}
          </div>
          <Input
            placeholder="我打算..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={config.maxLength}
            data-testid="ai-text-input"
          />
          <Button disabled={!text.trim()} onClick={handleSubmit} data-testid="ai-submit-btn">
            提交承諾
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="ai-reveal-btn">
        公布所有承諾
      </Button>
    </div>
  );
}
