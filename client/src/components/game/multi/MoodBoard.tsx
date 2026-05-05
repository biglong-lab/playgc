import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface MoodEntry extends Record<string, unknown> {
  boardId: string;
  userId: string;
  userName: string;
  emoji: string;
  note: string;
}

export interface MoodBoardConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  emojiPool: string[];
  notePlaceholder: string;
  maxLength: number;
}

export interface MoodBoardState extends Record<string, unknown> {
  entries: MoodEntry[];
  revealed: boolean;
}

interface MoodBoardProps {
  config: MoodBoardConfig;
  state: MoodBoardState;
  userId: string;
  onSubmit: (emoji: string, note: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: MoodBoardConfig = {
  title: "🎨 情緒看板",
  prompt: "選一個 emoji 代表你現在的心情，再加一句話",
  emojiPool: ["😊", "😌", "🤔", "😤", "😴", "🥳", "😰", "🔥", "💪", "🌈", "⚡", "🫶"],
  notePlaceholder: "說說為什麼...",
  maxLength: 60,
};

function extractConfig(raw: unknown): MoodBoardConfig {
  const r = raw as Record<string, unknown>;
  if (r && "emojiPool" in r && Array.isArray(r.emojiPool)) return r as unknown as MoodBoardConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("emojiPool" in c && Array.isArray(c.emojiPool)) return c as unknown as MoodBoardConfig;
  }
  return DEFAULT_CONFIG;
}

export function MoodBoard({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: MoodBoardProps) {
  const config = extractConfig(rawConfig as unknown);
  const [selectedEmoji, setSelectedEmoji] = useState("");
  const [note, setNote] = useState("");

  const myEntry = state.entries.find((e: MoodEntry) => e.userId === userId);
  const canSubmit = selectedEmoji.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(selectedEmoji, note.trim());
  }

  if (state.revealed) {
    const emojiCount: Record<string, number> = {};
    for (const e of state.entries) {
      emojiCount[e.emoji] = (emojiCount[e.emoji] ?? 0) + 1;
    }
    const topEmoji = Object.entries(emojiCount).sort((a, b) => b[1] - a[1]);

    return (
      <div className="p-4 space-y-4" data-testid="mb-result">
        <h2 className="text-xl font-bold" data-testid="mb-title">{config.title}</h2>
        <p className="text-xs text-muted-foreground" data-testid="mb-count">共 {state.entries.length} 人</p>
        {topEmoji.length > 0 && (
          <div className="flex flex-wrap gap-2 py-2">
            {topEmoji.map(([emoji, count]) => (
              <span key={emoji} className="text-2xl" title={`${count} 人`} data-testid={`mb-emoji-${emoji}`}>
                {emoji} <sup className="text-xs text-muted-foreground">{count}</sup>
              </span>
            ))}
          </div>
        )}
        {state.entries.length === 0 ? (
          <p className="text-muted-foreground" data-testid="mb-empty">還沒有人填寫情緒</p>
        ) : (
          <div className="space-y-2">
            {state.entries.map((entry) => (
              <div key={entry.boardId} className="flex items-start gap-3 p-3 border rounded-lg bg-amber-50/30" data-testid={`mb-entry-${entry.boardId}`}>
                <span className="text-2xl flex-shrink-0">{entry.emoji}</span>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{entry.userName}</p>
                  {entry.note && <p className="text-sm">{entry.note}</p>}
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
      <h2 className="text-xl font-bold" data-testid="mb-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="mb-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="mb-count">已填寫：{state.entries.length} 人</p>
      {state.entries.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="mb-empty">
          還沒有人分享心情，快來第一個！
        </p>
      )}

      {myEntry ? (
        <div className="p-3 border rounded bg-amber-50/30" data-testid="mb-my-entry">
          <p className="text-sm font-medium mb-1">🎨 你的心情</p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{myEntry.emoji}</span>
            {myEntry.note && <p className="text-sm text-muted-foreground">{myEntry.note}</p>}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">選一個 emoji</p>
          <div className="flex flex-wrap gap-3">
            {config.emojiPool.map((emoji) => (
              <button
                key={emoji}
                onClick={() => setSelectedEmoji(emoji)}
                className={[
                  "text-2xl p-2 rounded-xl border-2 transition-all",
                  selectedEmoji === emoji
                    ? "border-amber-400 bg-amber-50 scale-125"
                    : "border-transparent hover:border-amber-200",
                ].join(" ")}
                data-testid={`mb-emoji-btn-${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <Input
            placeholder={config.notePlaceholder}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={config.maxLength}
            data-testid="mb-note-input"
          />
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="mb-submit-btn">
            放上情緒看板
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="mb-reveal-btn">
          揭曉全員情緒
        </Button>
      )}
    </div>
  );
}

export default MoodBoard;
