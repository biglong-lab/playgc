import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface EnergyCard extends Record<string, unknown> {
  cardId: string;
  fromUserId: string;
  fromUserName: string;
  toName: string;
  emoji: string;
  message: string;
}

export interface EnergyBoostConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  maxLength: number;
  emojis: string[];
}

export interface EnergyBoostState extends Record<string, unknown> {
  cards: EnergyCard[];
  revealed: boolean;
}

interface EnergyBoostProps {
  config: EnergyBoostConfig;
  state: EnergyBoostState;
  myUserId: string;
  myUserName: string;
  onSend: (toName: string, emoji: string, message: string) => void;
  onReveal: () => void;
}

const DEFAULT_CONFIG: EnergyBoostConfig = {
  title: "能量加速器",
  prompt: "送出你的能量鼓勵！",
  maxLength: 40,
  emojis: ["⚡", "🔥", "💪", "🌟", "❤️"],
};

function extractConfig(raw: unknown): EnergyBoostConfig {
  const r = raw as Record<string, unknown>;
  if (r && "emojis" in r && Array.isArray(r.emojis)) return r as unknown as EnergyBoostConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("emojis" in c && Array.isArray(c.emojis)) return c as unknown as EnergyBoostConfig;
  }
  return DEFAULT_CONFIG;
}

export default function EnergyBoost({ config: rawConfig, state, myUserId, myUserName, onSend, onReveal }: EnergyBoostProps) {
  const config = extractConfig(rawConfig as unknown);
  const [toName, setToName] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState(config.emojis[0] ?? "⚡");
  const [message, setMessage] = useState("");

  const mySent = state.cards.filter((c) => c.fromUserId === myUserId);
  const myReceived = state.revealed ? state.cards.filter((c) => c.toName === myUserName) : [];

  function handleSend() {
    if (!toName.trim() || !message.trim()) return;
    onSend(toName.trim(), selectedEmoji, message.trim());
    setToName("");
    setMessage("");
  }

  if (state.revealed) {
    return (
      <div className="p-4 space-y-4" data-testid="eb-result">
        <h2 className="text-xl font-bold" data-testid="eb-title">{config.title}</h2>
        <p className="text-sm text-muted-foreground" data-testid="eb-total">共 {state.cards.length} 張能量卡</p>
        {myReceived.length > 0 ? (
          <div className="space-y-2" data-testid="eb-my-received">
            <p className="font-semibold">你收到的能量：</p>
            {myReceived.map((c) => (
              <div key={c.cardId} className="p-3 border rounded" data-testid={`eb-card-${c.cardId}`}>
                <span className="text-2xl mr-2">{c.emoji}</span>
                <span className="font-medium">{c.fromUserName}</span>
                <span className="mx-1">→</span>
                <span className="text-muted-foreground">{c.message}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground" data-testid="eb-no-received">這輪沒有收到能量卡</p>
        )}
        <div className="space-y-2">
          <p className="font-semibold">全部能量卡：</p>
          {state.cards.length === 0 ? (
            <p data-testid="eb-empty">還沒有人送出能量</p>
          ) : (
            state.cards.map((c) => (
              <div key={c.cardId} className="p-3 border rounded text-sm" data-testid={`eb-all-${c.cardId}`}>
                {c.emoji} <strong>{c.fromUserName}</strong> → <strong>{c.toName}</strong>：{c.message}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="eb-title">{config.title}</h2>
      <p className="text-sm" data-testid="eb-prompt">{config.prompt}</p>

      <div className="space-y-3">
        <Input
          placeholder="送給誰？（輸入名字）"
          value={toName}
          onChange={(e) => setToName(e.target.value)}
          maxLength={20}
          data-testid="eb-to-input"
        />
        <div className="flex gap-2 flex-wrap" data-testid="eb-emoji-row">
          {config.emojis.map((em) => (
            <button
              key={em}
              className={`text-2xl p-1 rounded border ${selectedEmoji === em ? "border-primary bg-primary/10" : "border-transparent"}`}
              onClick={() => setSelectedEmoji(em)}
              data-testid={`eb-emoji-${em}`}
            >
              {em}
            </button>
          ))}
        </div>
        <Input
          placeholder="一句話鼓勵..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={config.maxLength}
          data-testid="eb-msg-input"
        />
        <Button
          disabled={!toName.trim() || !message.trim()}
          onClick={handleSend}
          data-testid="eb-send-btn"
        >
          送出能量 {selectedEmoji}
        </Button>
      </div>

      {mySent.length > 0 && (
        <div className="text-sm text-muted-foreground" data-testid="eb-my-count">
          你已送出 {mySent.length} 張能量卡
        </div>
      )}

      <p className="text-sm text-muted-foreground" data-testid="eb-count">
        共 {state.cards.length} 張能量卡
      </p>

      <Button variant="outline" size="sm" onClick={onReveal} data-testid="eb-reveal-btn">
        公布所有能量
      </Button>
    </div>
  );
}
