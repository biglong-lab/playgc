import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface StandPosition extends Record<string, unknown> {
  posId: string;
  userId: string;
  userName: string;
  stance: string;
  reason: string;
}

export interface StandPointConfig extends Record<string, unknown> {
  title: string;
  issue: string;
  stances: string[];
  reasonLabel: string;
  maxLength: number;
}

export interface StandPointState extends Record<string, unknown> {
  positions: StandPosition[];
  revealed: boolean;
}

interface StandPointProps {
  config: StandPointConfig;
  state: StandPointState;
  userId: string;
  onSubmit: (stance: string, reason: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: StandPointConfig = {
  title: "🗣️ 立場陳述",
  issue: "你對這個議題的看法？",
  stances: ["支持", "中立", "反對"],
  reasonLabel: "說明你的理由",
  maxLength: 150,
};

function extractConfig(raw: unknown): StandPointConfig {
  const r = raw as Record<string, unknown>;
  if (r && "stances" in r && Array.isArray(r.stances) && "issue" in r) return r as unknown as StandPointConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("stances" in c && Array.isArray(c.stances) && "issue" in c) return c as unknown as StandPointConfig;
  }
  return DEFAULT_CONFIG;
}

const STANCE_COLORS: Record<string, string> = {
  "支持": "bg-green-100 text-green-800 border-green-300",
  "反對": "bg-red-100 text-red-800 border-red-300",
  "中立": "bg-gray-100 text-gray-700 border-gray-300",
};

function stanceColor(stance: string) {
  return STANCE_COLORS[stance] ?? "bg-violet-100 text-violet-800 border-violet-300";
}

export function StandPoint({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: StandPointProps) {
  const config = extractConfig(rawConfig as unknown);
  const [picked, setPicked] = useState("");
  const [reason, setReason] = useState("");

  const myPos = state.positions.find((p: StandPosition) => p.userId === userId);
  const canSubmit = picked.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(picked, reason.trim());
  }

  if (state.revealed) {
    const tally: Record<string, StandPosition[]> = {};
    for (const stance of config.stances) tally[stance] = [];
    for (const pos of state.positions) {
      if (!tally[pos.stance]) tally[pos.stance] = [];
      tally[pos.stance].push(pos);
    }

    return (
      <div className="p-4 space-y-4" data-testid="sp-result">
        <h2 className="text-xl font-bold" data-testid="sp-title">{config.title}</h2>
        <p className="text-sm font-medium" data-testid="sp-issue">{config.issue}</p>
        <p className="text-xs text-muted-foreground" data-testid="sp-count">共 {state.positions.length} 人陳述</p>
        {state.positions.length === 0 ? (
          <p className="text-muted-foreground" data-testid="sp-empty">還沒有人陳述立場</p>
        ) : (
          <div className="space-y-4">
            {config.stances.map((stance) => (
              <div key={stance}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge className={stanceColor(stance)}>{stance}</Badge>
                  <span className="text-xs text-muted-foreground">{tally[stance]?.length ?? 0} 人</span>
                </div>
                {(tally[stance] ?? []).map((pos) => (
                  <div key={pos.posId} className="ml-4 p-2 border-l-2 border-gray-200 mb-1" data-testid={`sp-pos-${pos.posId}`}>
                    <p className="text-xs text-muted-foreground">{pos.userName}</p>
                    {pos.reason && <p className="text-sm">{pos.reason}</p>}
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
      <h2 className="text-xl font-bold" data-testid="sp-title">{config.title}</h2>
      <p className="text-sm font-medium" data-testid="sp-issue">{config.issue}</p>
      <p className="text-xs text-muted-foreground" data-testid="sp-count">已陳述：{state.positions.length} 人</p>
      {state.positions.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="sp-empty">
          還沒有人陳述立場，快來第一個！
        </p>
      )}

      {myPos ? (
        <div className="p-3 border rounded bg-violet-50/30" data-testid="sp-my-position">
          <p className="text-sm font-medium mb-1">🗣️ 你的立場</p>
          <Badge className={stanceColor(myPos.stance)}>{myPos.stance}</Badge>
          {myPos.reason && <p className="text-xs text-muted-foreground mt-1">{myPos.reason}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">選擇你的立場</p>
          <div className="flex flex-wrap gap-2">
            {config.stances.map((stance) => (
              <button
                key={stance}
                onClick={() => setPicked(stance)}
                className={[
                  "px-4 py-2 rounded-full border-2 text-sm font-medium transition-all",
                  picked === stance
                    ? `${stanceColor(stance)} border-current scale-105`
                    : "border-gray-200 bg-white hover:border-gray-400",
                ].join(" ")}
                data-testid={`sp-stance-${stance}`}
              >
                {stance}
              </button>
            ))}
          </div>
          <Textarea
            placeholder={config.reasonLabel}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={config.maxLength}
            rows={3}
            data-testid="sp-reason-input"
          />
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="sp-submit-btn">
            送出立場
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="sp-reveal-btn">
          公布立場分布
        </Button>
      )}
    </div>
  );
}

export default StandPoint;
