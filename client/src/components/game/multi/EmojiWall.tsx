import { useState } from "react";
import { Smile } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── 型別 ──────────────────────────────────────────────
export interface EmojiEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  emoji: string;
  reason: string;
}

export interface EmojiWallConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  emojis: string[];
  reasonLabel: string;
  askReason: boolean;
}

export interface EmojiWallState extends Record<string, unknown> {
  entries: EmojiEntry[];
  revealed: boolean;
}

interface Props {
  config: EmojiWallConfig;
  state: EmojiWallState;
  userId: string;
  isTeamLead?: boolean;
  onSubmit: (emoji: string, reason: string) => void;
  onReveal: () => void;
}

function groupByEmoji(entries: EmojiEntry[]): Record<string, EmojiEntry[]> {
  return entries.reduce<Record<string, EmojiEntry[]>>((acc, e) => {
    acc[e.emoji] = [...(acc[e.emoji] ?? []), e];
    return acc;
  }, {});
}

// ── 元件 ──────────────────────────────────────────────
export function EmojiWall({ config, state, userId, isTeamLead, onSubmit, onReveal }: Props) {
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const myEntry = state.entries.find((e) => e.userId === userId);
  const hasSubmitted = !!myEntry;
  const grouped = groupByEmoji(state.entries);
  const sorted = Object.entries(grouped).sort(([, a], [, b]) => b.length - a.length);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Smile className="h-5 w-5 text-yellow-500" />
        <h3 className="font-bold text-lg" data-testid="ew-title">
          {config.title}
        </h3>
      </div>
      <p className="text-sm font-medium" data-testid="ew-prompt">
        {config.prompt}
      </p>

      <Badge variant="outline" data-testid="ew-count">
        {state.entries.length} 人已回應
      </Badge>

      {!hasSubmitted && (
        <div className="space-y-3 border rounded-lg p-4">
          <div className="grid grid-cols-5 gap-2" data-testid="ew-emoji-grid">
            {config.emojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                data-testid={`ew-emoji-${emoji}`}
                className={`text-2xl p-2 rounded-lg border-2 transition-all ${
                  selectedEmoji === emoji
                    ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 scale-110"
                    : "border-transparent hover:border-gray-300"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {config.askReason && selectedEmoji && (
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={config.reasonLabel}
              maxLength={80}
              data-testid="ew-reason-input"
              className="w-full border rounded px-3 py-2 text-sm"
            />
          )}
          <Button
            onClick={() => onSubmit(selectedEmoji!, reason)}
            disabled={!selectedEmoji}
            className="w-full"
            data-testid="ew-submit-btn"
          >
            提交 {selectedEmoji ?? "（請先選擇）"}
          </Button>
        </div>
      )}

      {hasSubmitted && (
        <div
          className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20"
          data-testid="ew-my-entry"
        >
          <p className="text-xs text-muted-foreground mb-1">我的回應</p>
          <p className="text-3xl">{myEntry!.emoji}</p>
          {myEntry!.reason && (
            <p className="text-xs text-muted-foreground mt-1">{myEntry!.reason}</p>
          )}
          <p className="text-xs text-muted-foreground mt-1">等待揭曉結果...</p>
        </div>
      )}

      {!state.revealed && state.entries.length === 0 && (
        <p
          className="text-sm text-muted-foreground text-center py-4"
          data-testid="ew-empty"
        >
          還沒有人回應
        </p>
      )}

      {state.revealed && (
        <div className="space-y-3" data-testid="ew-result">
          {state.entries.length === 0 && (
            <p
              className="text-sm text-muted-foreground text-center py-4"
              data-testid="ew-empty"
            >
              沒有回應資料
            </p>
          )}
          {sorted.map(([emoji, entries]) => (
            <div
              key={emoji}
              className="border rounded-lg p-3"
              data-testid={`ew-group-${emoji}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{emoji}</span>
                <Badge variant="secondary">{entries.length} 人</Badge>
              </div>
              {entries.map((e) => (
                <div
                  key={e.entryId}
                  className="text-sm"
                  data-testid={`ew-entry-${e.entryId}`}
                >
                  <span className="font-medium">{e.userName}</span>
                  {e.reason && (
                    <span className="text-muted-foreground ml-1">— {e.reason}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {isTeamLead && !state.revealed && state.entries.length > 0 && (
        <Button onClick={onReveal} className="w-full" data-testid="ew-reveal-btn">
          揭曉結果
        </Button>
      )}
    </div>
  );
}

export default EmojiWall;
