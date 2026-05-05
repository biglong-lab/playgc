// 🏷️ NameCard — 多人名牌牆元件（純 UI）
// 每人填入姓名、角色、有趣事實，形成人物名牌牆
// 適用：破冰自我介紹、新員工入職、課程認識同學、網路研討會

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { User, Users } from "lucide-react";

export interface NameCardField {
  key: string;
  label: string;
  placeholder?: string;
  maxLength?: number;
}

export interface NameCardEntry {
  id: string;
  userId: string;
  fields: Record<string, string>;
  emoji?: string;
  submittedAt: number;
}

export interface NameCardConfig {
  title?: string;
  subtitle?: string;
  fields: NameCardField[];
  emojiOptions?: string[];
  columns?: 2 | 3;
}

export interface NameCardState extends Record<string, unknown> {
  cards: NameCardEntry[];
}

const DEFAULT_EMOJIS = ["😊", "🎯", "🚀", "💡", "🌟", "🎨", "🎵", "🏆", "🌈", "🔥"];

interface NameCardProps {
  config: NameCardConfig;
  state: NameCardState;
  myUserId: string;
  onSubmit: (fields: Record<string, string>, emoji?: string) => Promise<void>;
}

export default function NameCard({ config, state, myUserId, onSubmit }: NameCardProps) {
  const emojiOptions = config.emojiOptions ?? DEFAULT_EMOJIS;
  const [fields, setFields] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    config.fields.forEach((f) => { init[f.key] = ""; });
    return init;
  });
  const [selectedEmoji, setSelectedEmoji] = useState(emojiOptions[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myCard = state.cards.find((c) => c.userId === myUserId);
  const hasSubmitted = !!myCard;
  const cols = config.columns ?? 2;

  const requiredFilled = config.fields
    .filter((f) => !f.placeholder?.includes("選填"))
    .every((f) => fields[f.key]?.trim());

  const handleSubmit = async () => {
    if (!requiredFilled || isSubmitting || hasSubmitted) return;
    const trimmed: Record<string, string> = {};
    config.fields.forEach((f) => { trimmed[f.key] = fields[f.key]?.trim() ?? ""; });
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed, selectedEmoji);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4" data-testid="name-card-root">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" data-testid="name-card-title">
              <User className="w-5 h-5 text-indigo-500" />
              {config.title ?? "🏷️ 自我介紹牌"}
            </CardTitle>
            {state.cards.length > 0 && (
              <Badge variant="outline" data-testid="name-card-count">
                <Users className="w-3 h-3 mr-1" />
                {state.cards.length} 人
              </Badge>
            )}
          </div>
          {config.subtitle && (
            <p className="text-sm text-muted-foreground" data-testid="name-card-subtitle">{config.subtitle}</p>
          )}
        </CardHeader>
        <CardContent>
          {hasSubmitted && myCard ? (
            <div className="py-3 space-y-2 text-center" data-testid="name-card-submitted">
              <p className="text-3xl">{myCard.emoji ?? "😊"}</p>
              {config.fields.map((f) => (
                <p key={f.key} className="text-sm">
                  <span className="text-muted-foreground">{f.label}：</span>
                  <span className="font-medium">{myCard.fields[f.key]}</span>
                </p>
              ))}
              <p className="text-xs text-green-600 mt-2">✅ 名牌已建立！</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {emojiOptions.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setSelectedEmoji(e)}
                    className={`text-xl p-1 rounded transition-transform ${
                      selectedEmoji === e ? "ring-2 ring-primary scale-110" : "hover:scale-105"
                    }`}
                    data-testid={`emoji-pick-${e}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
              {config.fields.map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                  <Input
                    value={fields[f.key] ?? ""}
                    onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder ?? f.label}
                    maxLength={f.maxLength ?? 40}
                    data-testid={`field-input-${f.key}`}
                  />
                </div>
              ))}
              <Button
                className="w-full"
                onClick={() => void handleSubmit()}
                disabled={!requiredFilled || isSubmitting}
                data-testid="name-card-submit-btn"
              >
                建立我的名牌
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {state.cards.length > 0 && (
        <div className={`grid grid-cols-${cols} gap-2`} data-testid="name-card-wall">
          {state.cards
            .slice()
            .sort((a, b) => a.submittedAt - b.submittedAt)
            .map((card) => (
              <Card
                key={card.id}
                className={`border-indigo-100 ${card.userId === myUserId ? "ring-2 ring-indigo-300" : ""}`}
                data-testid={`name-card-item-${card.id}`}
              >
                <CardContent className="pt-3 pb-3 text-center">
                  <p className="text-2xl mb-1">{card.emoji ?? "😊"}</p>
                  {config.fields.slice(0, 2).map((f) => (
                    <p key={f.key} className="text-xs line-clamp-1">
                      {card.fields[f.key]}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
}
