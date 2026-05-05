import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export interface ThanksNote extends Record<string, unknown> {
  noteId: string;
  fromUserId: string;
  fromUserName: string;
  recipient: string;
  message: string;
}

export interface ThankYouNoteConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  recipientLabel: string;
  messageLabel: string;
  maxLength: number;
  anonymous: boolean;
}

export interface ThankYouNoteState extends Record<string, unknown> {
  notes: ThanksNote[];
  revealed: boolean;
}

interface ThankYouNoteProps {
  config: ThankYouNoteConfig;
  state: ThankYouNoteState;
  userId: string;
  onSubmit: (recipient: string, message: string) => void;
  onReveal: () => void;
  isTeamLead?: boolean;
}

const DEFAULT_CONFIG: ThankYouNoteConfig = {
  title: "💌 感謝便條",
  prompt: "寫一張感謝便條給你想感謝的人",
  recipientLabel: "感謝誰",
  messageLabel: "感謝的話",
  maxLength: 150,
  anonymous: false,
};

function extractConfig(raw: unknown): ThankYouNoteConfig {
  const r = raw as Record<string, unknown>;
  if (r && "recipientLabel" in r && typeof r.recipientLabel === "string") return r as unknown as ThankYouNoteConfig;
  if (r && r.config) {
    const c = r.config as Record<string, unknown>;
    if ("recipientLabel" in c && typeof c.recipientLabel === "string") return c as unknown as ThankYouNoteConfig;
  }
  return DEFAULT_CONFIG;
}

export function ThankYouNote({ config: rawConfig, state, userId, onSubmit, onReveal, isTeamLead }: ThankYouNoteProps) {
  const config = extractConfig(rawConfig as unknown);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");

  const myNote = state.notes.find((n: ThanksNote) => n.fromUserId === userId);
  const canSubmit = recipient.trim().length > 0 && message.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(recipient.trim(), message.trim());
  }

  if (state.revealed) {
    const byRecipient: Record<string, ThanksNote[]> = {};
    for (const note of state.notes) {
      if (!byRecipient[note.recipient]) byRecipient[note.recipient] = [];
      byRecipient[note.recipient].push(note);
    }

    return (
      <div className="p-4 space-y-4" data-testid="tyn-result">
        <h2 className="text-xl font-bold" data-testid="tyn-title">{config.title}</h2>
        <p className="text-xs text-muted-foreground" data-testid="tyn-count">
          共 {state.notes.length} 張便條
        </p>
        {state.notes.length === 0 ? (
          <p className="text-muted-foreground" data-testid="tyn-empty">還沒有感謝便條</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(byRecipient).map(([person, notes]) => (
              <div key={person} className="space-y-2" data-testid={`tyn-recipient-${person}`}>
                <p className="font-semibold text-sm text-pink-700">💌 給 {person}</p>
                {notes.map((note) => (
                  <div key={note.noteId} className="p-3 border rounded-lg bg-pink-50/30" data-testid={`tyn-note-${note.noteId}`}>
                    <p className="text-sm">{note.message}</p>
                    {!config.anonymous && (
                      <p className="text-xs text-muted-foreground mt-1">— {note.fromUserName}</p>
                    )}
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
      <h2 className="text-xl font-bold" data-testid="tyn-title">{config.title}</h2>
      <p className="text-sm text-muted-foreground" data-testid="tyn-prompt">{config.prompt}</p>
      <p className="text-xs text-muted-foreground" data-testid="tyn-count">
        已送出：{state.notes.length} 張
      </p>
      {state.notes.length === 0 && (
        <p className="text-xs text-muted-foreground italic" data-testid="tyn-empty">
          還沒有感謝便條，快來第一個！
        </p>
      )}

      {myNote ? (
        <div className="p-3 border rounded bg-pink-50/30" data-testid="tyn-my-note">
          <p className="text-sm font-medium mb-1">💌 你的感謝便條已送出</p>
          <p className="text-xs text-muted-foreground">給：{myNote.recipient}</p>
          <p className="text-xs mt-1">{myNote.message}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">{config.recipientLabel}</p>
            <Input
              placeholder="輸入對方名字"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              data-testid="tyn-recipient-input"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1">{config.messageLabel}</p>
            <Textarea
              placeholder="寫下你想說的感謝..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={config.maxLength}
              rows={3}
              data-testid="tyn-message-input"
            />
          </div>
          <Button disabled={!canSubmit} onClick={handleSubmit} data-testid="tyn-submit-btn">
            送出感謝便條 💌
          </Button>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <Button variant="outline" size="sm" onClick={onReveal} data-testid="tyn-reveal-btn">
          公布感謝便條牆
        </Button>
      )}
    </div>
  );
}

export default ThankYouNote;
