import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface ValueSelection extends Record<string, unknown> {
  selectionId: string;
  userId: string;
  userName: string;
  cards: string[];
}

export interface ValueCardConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  cardPool: string[];
  maxSelect: number;
}

export interface ValueCardState extends Record<string, unknown> {
  selections: ValueSelection[];
  revealed: boolean;
}

interface ValueCardProps {
  config: ValueCardConfig;
  state: ValueCardState;
  userId: string;
  onSubmit: (cards: string[]) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: ValueCardConfig = {
  title: "🃏 價值卡選單",
  prompt: "從以下卡片中選出最重要的幾張",
  cardPool: ["誠信", "創新", "團隊合作", "顧客導向", "卓越", "學習成長", "責任", "多元包容"],
  maxSelect: 3,
};

function extractConfig(raw: unknown): ValueCardConfig {
  const r = raw as Record<string, unknown>;
  if (r && "cardPool" in r && Array.isArray(r.cardPool)) return r as unknown as ValueCardConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("cardPool" in c && Array.isArray(c.cardPool)) return c as unknown as ValueCardConfig;
  }
  return DEFAULT_CONFIG;
}

export function ValueCard({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: ValueCardProps) {
  const config = extractConfig(rawConfig as unknown);
  const [picked, setPicked] = useState<string[]>([]);

  const mySelection = state.selections.find((s: ValueSelection) => s.userId === userId);
  const canSubmit = picked.length > 0 && picked.length <= config.maxSelect;

  function toggleCard(card: string) {
    if (picked.includes(card)) {
      setPicked(picked.filter((c) => c !== card));
    } else if (picked.length < config.maxSelect) {
      setPicked([...picked, card]);
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(picked);
  }

  if (state.revealed) {
    const tally: Record<string, number> = {};
    for (const sel of state.selections) {
      for (const card of sel.cards) {
        tally[card] = (tally[card] ?? 0) + 1;
      }
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);

    return (
      <div className="p-4 space-y-4" data-testid="vc-result">
        <h2 className="text-xl font-bold" data-testid="vc-title">{config.title}</h2>
        <p className="text-xs text-muted-foreground" data-testid="vc-count">
          共 {state.selections.length} 人參與
        </p>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground" data-testid="vc-empty">還沒有人選卡片</p>
        ) : (
          <div className="space-y-2">
            {sorted.map(([card, count]) => (
              <div
                key={card}
                className="flex items-center justify-between p-3 border rounded-lg bg-violet-50/30"
                data-testid={`vc-tally-${card}`}
              >
                <span className="font-medium text-sm">{card}</span>
                <Badge variant="secondary">{count} 票</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="vc-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="vc-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="vc-count">
        已選：{state.selections.length} 人
      </p>
      {state.selections.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="vc-empty">
          還沒有人選卡片，快來第一個！
        </p>
      )}

      {mySelection ? (
        <div className="p-3 border rounded bg-violet-50/30" data-testid="vc-my-selection">
          <p className="text-sm font-medium mb-2">🃏 你選的價值卡</p>
          <div className="flex flex-wrap gap-2">
            {mySelection.cards.map((card: string) => (
              <Badge key={card} variant="default">{card}</Badge>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            選 {config.maxSelect} 張（已選 {picked.length}/{config.maxSelect}）
          </p>
          <div className="flex flex-wrap gap-2">
            {config.cardPool.map((card) => {
              const selected = picked.includes(card);
              const disabled = !selected && picked.length >= config.maxSelect;
              return (
                <button
                  key={card}
                  onClick={() => !disabled && toggleCard(card)}
                  className={[
                    "px-3 py-1.5 rounded-full border text-sm transition-colors",
                    selected
                      ? "bg-violet-600 text-white border-violet-600"
                      : disabled
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-300 hover:border-violet-400",
                  ].join(" ")}
                  data-testid={`vc-card-${card}`}
                >
                  {card}
                </button>
              );
            })}
          </div>
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="vc-submit-btn">
            確認送出（{picked.length}/{config.maxSelect}）
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="vc-reveal-btn">
          公布票數結果
        </Button>
      )}
    </div>
  );
}

export default ValueCard;
