import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface SkillEntry extends Record<string, unknown> {
  mapId: string;
  userId: string;
  userName: string;
  offer: string;
  need: string;
}

export interface SkillMapConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  offerLabel: string;
  needLabel: string;
  maxLength: number;
}

export interface SkillMapState extends Record<string, unknown> {
  maps: SkillEntry[];
  revealed: boolean;
}

interface SkillMapProps {
  config: SkillMapConfig;
  state: SkillMapState;
  userId: string;
  onSubmit: (offer: string, need: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: SkillMapConfig = {
  title: "🗺️ 技能地圖",
  prompt: "告訴大家你能提供什麼、你需要什麼",
  offerLabel: "我能提供",
  needLabel: "我需要",
  maxLength: 80,
};

function extractConfig(raw: unknown): SkillMapConfig {
  const r = raw as Record<string, unknown>;
  if (r && "offerLabel" in r && typeof r.offerLabel === "string") return r as unknown as SkillMapConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("offerLabel" in c && typeof c.offerLabel === "string") return c as unknown as SkillMapConfig;
  }
  return DEFAULT_CONFIG;
}

export function SkillMap({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: SkillMapProps) {
  const config = extractConfig(rawConfig as unknown);
  const [offer, setOffer] = useState("");
  const [need, setNeed] = useState("");

  const myEntry = state.maps.find((m: SkillEntry) => m.userId === userId);
  const canSubmit = offer.trim().length > 0 && need.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(offer.trim(), need.trim());
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="sm-result">
        <h2 className="text-xl font-bold" data-testid="sm-title">{config.title}</h2>
        <p className="text-xs text-muted-foreground" data-testid="sm-count">共 {state.maps.length} 人填寫</p>
        {state.maps.length === 0 ? (
          <p className="text-muted-foreground" data-testid="sm-empty">還沒有人填寫技能地圖</p>
        ) : (
          <div className="space-y-3">
            {state.maps.map((entry) => (
              <div key={entry.mapId} className="p-4 border rounded-lg bg-emerald-50/30" data-testid={`sm-entry-${entry.mapId}`}>
                <p className="text-xs font-semibold text-emerald-700 mb-2">{entry.userName}</p>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
                    ✅ {entry.offer}
                  </Badge>
                  <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
                    🙋 {entry.need}
                  </Badge>
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
      <h2 className="text-xl font-bold" data-testid="sm-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="sm-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="sm-count">已填寫：{state.maps.length} 人</p>
      {state.maps.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="sm-empty">
          還沒有人填寫，快來建立你的技能地圖！
        </p>
      )}

      {myEntry ? (
        <div className="p-3 border rounded bg-emerald-50/30" data-testid="sm-my-entry">
          <p className="text-sm font-medium mb-2">🗺️ 你的技能地圖</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
              ✅ {myEntry.offer}
            </Badge>
            <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
              🙋 {myEntry.need}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">{config.offerLabel}</p>
            <Input
              placeholder="我擅長、我能幫你..."
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              maxLength={config.maxLength}
              data-testid="sm-offer-input"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">{config.needLabel}</p>
            <Input
              placeholder="我需要、我正在學..."
              value={need}
              onChange={(e) => setNeed(e.target.value)}
              maxLength={config.maxLength}
              data-testid="sm-need-input"
            />
          </div>
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="sm-submit-btn">
            放上地圖
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="sm-reveal-btn">
          展開技能地圖
        </Button>
      )}
    </div>
  );
}

export default SkillMap;
