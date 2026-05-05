import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CompassCard extends Record<string, unknown> {
  cardId: string;
  userId: string;
  userName: string;
  north: string;
  south: string;
  east: string;
  west: string;
}

export interface PersonalCompassConfig extends Record<string, unknown> {
  title: string;
  northLabel: string;
  southLabel: string;
  eastLabel: string;
  westLabel: string;
}

export interface PersonalCompassState extends Record<string, unknown> {
  cards: CompassCard[];
  revealed: boolean;
}

interface PersonalCompassProps {
  config: PersonalCompassConfig;
  state: PersonalCompassState;
  myUserId: string;
  onSubmit: (north: string, south: string, east: string, west: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: PersonalCompassConfig = {
  title: "🧭 個人指南針",
  northLabel: "N 優勢",
  southLabel: "S 挑戰",
  eastLabel: "E 機會",
  westLabel: "W 障礙",
};

function extractConfig(raw: unknown): PersonalCompassConfig {
  const r = raw as Record<string, unknown>;
  if (r && "northLabel" in r) return r as unknown as PersonalCompassConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("northLabel" in c) return c as unknown as PersonalCompassConfig;
  }
  return DEFAULT_CONFIG;
}

export default function PersonalCompass({ config: rawConfig, state, myUserId, onSubmit, onReveal }: PersonalCompassProps) {
  const config = extractConfig(rawConfig as unknown);
  const [north, setNorth] = useState("");
  const [south, setSouth] = useState("");
  const [east, setEast] = useState("");
  const [west, setWest] = useState("");

  const myCard = state.cards.find((c) => c.userId === myUserId);
  const allFilled = north.trim() && south.trim() && east.trim() && west.trim();

  function handleSubmit() {
    if (!allFilled) return;
    onSubmit(north.trim(), south.trim(), east.trim(), west.trim());
  }

  const DIRS = [
    { key: "north" as const, label: config.northLabel, emoji: "⬆️", color: "bg-emerald-50" },
    { key: "south" as const, label: config.southLabel, emoji: "⬇️", color: "bg-red-50" },
    { key: "east" as const, label: config.eastLabel, emoji: "➡️", color: "bg-blue-50" },
    { key: "west" as const, label: config.westLabel, emoji: "⬅️", color: "bg-amber-50" },
  ];

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="pc-result">
        <h2 className="text-xl font-bold" data-testid="pc-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="pc-count">共 {state.cards.length} 份指南針</p>
        {state.cards.length === 0 ? (
          <p className="text-muted-foreground" data-testid="pc-empty">還沒有人填寫指南針</p>
        ) : (
          <div className="space-y-4">
            {state.cards.map((card) => (
              <div key={card.cardId} className="p-4 border rounded-lg" data-testid={`pc-card-${card.cardId}`}>
                <p className="font-semibold mb-2 text-sm">{card.userName}</p>
                <div className="grid grid-cols-2 gap-2">
                  {DIRS.map((d) => (
                    <div key={d.key} className={`p-2 rounded text-xs ${d.color}`}>
                      <span className="font-medium">{d.emoji} {d.label}：</span>
                      <span>{card[d.key] as string}</span>
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
      <h2 className="text-xl font-bold" data-testid="pc-title">{config.title}</h2>
      <p className="text-xs text-muted-foreground" data-testid="pc-count">已填寫：{state.cards.length} 人</p>

      {myCard ? (
        <div className="p-3 border rounded bg-muted/30" data-testid="pc-my-card">
          <p className="text-sm font-medium mb-2">🧭 你已填寫指南針</p>
          <div className="grid grid-cols-2 gap-2">
            {DIRS.map((d) => (
              <p key={d.key} className="text-xs text-muted-foreground">{d.emoji} {d.label}：{myCard[d.key] as string}</p>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {DIRS.map((d, idx) => (
            <div key={d.key} className={`p-3 rounded-lg ${d.color}`}>
              <p className="text-sm font-medium mb-1">{d.emoji} {d.label}</p>
              <Input
                placeholder={`填寫${d.label}...`}
                value={[north, south, east, west][idx]}
                onChange={(e) => [setNorth, setSouth, setEast, setWest][idx](e.target.value)}
                data-testid={`pc-${d.key}-input`}
              />
            </div>
          ))}
          <Button disabled={!allFilled} onClick={handleSubmit} data-testid="pc-submit-btn">
            提交指南針
          </Button>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="pc-reveal-btn">
        公布所有指南針
      </Button>
    </div>
  );
}
