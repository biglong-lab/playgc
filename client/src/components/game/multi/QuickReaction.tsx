import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

const EMOJIS = ["👍", "❤️", "🎉", "😮", "🤔", "👏", "🔥", "💡"];

interface QrReaction extends Record<string, unknown> {
  reactionId: string;
  userId: string;
  userName: string;
  emoji: string;
}

interface QuickReactionState extends Record<string, unknown> {
  prompt: string;
  reactions: QrReaction[];
  revealed: boolean;
}

interface QuickReactionConfig {
  prompt?: string;
  title?: string;
}

function extractConfig(raw: Record<string, unknown>): QuickReactionConfig {
  return {
    prompt: typeof raw.prompt === "string" ? raw.prompt : "你對這個主題的感受是？",
    title: typeof raw.title === "string" ? raw.title : "快速反應",
  };
}

export interface QuickReactionProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function QuickReaction({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: QuickReactionProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const defaultState: QuickReactionState = {
    prompt: cfg.prompt ?? "你對這個主題的感受是？",
    reactions: [],
    revealed: false,
  };

  const { state, updateState, isLoaded } = useTeamPagePersistence<QuickReactionState>({
    gameId,
    sessionId,
    pageId,
    type: "quick_reaction",
    defaultState,
  });

  const [selected, setSelected] = useState<string | null>(null);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="qr-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myReaction = state.reactions.find((r) => r.userId === userId);

  function handleReact(emoji: string) {
    if (myReaction) return;
    const reaction: QrReaction = {
      reactionId: `${userId}-${Date.now()}`,
      userId,
      userName,
      emoji,
    };
    setSelected(emoji);
    updateState({ ...state, reactions: [...state.reactions, reaction] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  // 統計各 emoji 數量
  const counts: Record<string, number> = {};
  for (const e of EMOJIS) counts[e] = 0;
  for (const r of state.reactions) {
    if (counts[r.emoji] !== undefined) counts[r.emoji]++;
  }
  const total = state.reactions.length;

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <h2 className="text-xl font-bold text-center" data-testid="qr-title">
        {cfg.title ?? "快速反應"}
      </h2>
      <p className="text-center text-muted-foreground" data-testid="qr-prompt">
        {state.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="qr-count">
        已反應：{total} 人
      </p>

      {!myReaction && !state.revealed && (
        <div className="grid grid-cols-4 gap-3" data-testid="qr-emoji-grid">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              data-testid={`qr-emoji-${emoji}`}
              className={`text-3xl p-3 rounded-xl border-2 transition-all hover:scale-110 ${
                selected === emoji ? "border-primary bg-primary/10 scale-110" : "border-muted hover:border-primary/50"
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {myReaction && (
        <div className="text-center p-3 rounded-xl bg-primary/10 border border-primary" data-testid="qr-my-reaction">
          你選了 <span className="text-2xl">{myReaction.emoji}</span>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-2" data-testid="qr-result">
          {EMOJIS.filter((e) => counts[e] > 0).sort((a, b) => counts[b] - counts[a]).map((emoji) => (
            <div key={emoji} className="flex items-center gap-3" data-testid={`qr-bar-${emoji}`}>
              <span className="text-2xl w-8 text-center">{emoji}</span>
              <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                <div
                  className="bg-primary h-4 rounded-full transition-all"
                  style={{ width: total > 0 ? `${(counts[emoji] / total) * 100}%` : "0%" }}
                />
              </div>
              <span className="text-sm font-medium w-8 text-right">{counts[emoji]}</span>
            </div>
          ))}
          {total === 0 && (
            <p className="text-center text-muted-foreground" data-testid="qr-empty">
              尚無反應
            </p>
          )}
        </div>
      ) : (
        isTeamLead && myReaction && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="qr-reveal-btn">
            公布結果
          </Button>
        )
      )}
    </div>
  );
}

export default QuickReaction;
