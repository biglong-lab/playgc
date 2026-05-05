import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, X } from "lucide-react";

export interface BrainEntry extends Record<string, unknown> {
  dumpId: string;
  userId: string;
  userName: string;
  ideas: string[];
}

export interface BrainDumpConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxItems: number;
  maxLength: number;
}

export interface BrainDumpState extends Record<string, unknown> {
  dumps: BrainEntry[];
  revealed: boolean;
}

interface BrainDumpProps {
  config: BrainDumpConfig;
  state: BrainDumpState;
  myUserId: string;
  onSubmit: (ideas: string[]) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: BrainDumpConfig = {
  title: "💡 腦力傾瀉",
  prompt: "盡量多寫！每行一個想法",
  maxItems: 5,
  maxLength: 40,
};

function extractConfig(raw: unknown): BrainDumpConfig {
  const r = raw as Record<string, unknown>;
  if (r && "maxItems" in r && typeof r.maxItems === "number" && !("tableCount" in r)) {
    return r as unknown as BrainDumpConfig;
  }
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("maxItems" in c && typeof c.maxItems === "number") return c as unknown as BrainDumpConfig;
  }
  return DEFAULT_CONFIG;
}

export default function BrainDump({ config: rawConfig, state, myUserId, onSubmit, onReveal }: BrainDumpProps) {
  const config = extractConfig(rawConfig as unknown);
  const [ideas, setIdeas] = useState<string[]>([""]);

  const myDump = state.dumps.find((d) => d.userId === myUserId);
  const filledIdeas = ideas.filter((i) => i.trim());
  const canSubmit = filledIdeas.length > 0;

  function addIdea() {
    if (ideas.length < config.maxItems) setIdeas([...ideas, ""]);
  }

  function updateIdea(idx: number, val: string) {
    const next = [...ideas];
    next[idx] = val;
    setIdeas(next);
  }

  function removeIdea(idx: number) {
    if (ideas.length === 1) return;
    setIdeas(ideas.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(filledIdeas);
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="bd-result">
        <h2 className="text-xl font-bold" data-testid="bd-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="bd-count">共 {state.dumps.length} 人傾瀉</p>
        {state.dumps.length === 0 ? (
          <p className="text-muted-foreground" data-testid="bd-empty">還沒有人提交想法</p>
        ) : (
          <div className="space-y-3">
            {state.dumps.map((dump) => (
              <div key={dump.dumpId} className="p-3 border rounded-lg" data-testid={`bd-user-${dump.dumpId}`}>
                <p className="text-sm font-semibold mb-2">{dump.userName}</p>
                <ul className="space-y-1">
                  {dump.ideas.map((idea, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-1">
                      <span className="text-muted-foreground">•</span>
                      <span>{idea}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="bd-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="bd-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="bd-count">已提交：{state.dumps.length} 人</p>

      {myDump ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="bd-my-dump">
          <p className="text-sm font-medium mb-1">💡 你已提交 {myDump.ideas.length} 條想法</p>
          <ul className="space-y-0.5">
            {myDump.ideas.map((idea, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {idea}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="space-y-2">
          {ideas.map((idea, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <Input
                placeholder={`想法 ${idx + 1}...`}
                value={idea}
                onChange={(e) => updateIdea(idx, e.target.value)}
                maxLength={config.maxLength}
                data-testid={`bd-idea-${idx}`}
              />
              {ideas.length > 1 && (
                <Button variant="ghost" size="icon" onClick={() => removeIdea(idx)} className="shrink-0">
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
          {ideas.length < config.maxItems && (
            <Button variant="ghost" size="sm" onClick={addIdea} data-testid="bd-add-btn">
              <Plus className="h-4 w-4 mr-1" />再加一條
            </Button>
          )}
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="bd-submit-btn">
            提交想法
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="bd-reveal-btn">
        公布所有想法
      </Button>
    </div>
  );
}
