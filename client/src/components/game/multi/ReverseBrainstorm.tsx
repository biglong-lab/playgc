import { useState } from "react";
import { Loader2, FlipHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";

interface ReverseEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  badIdea: string;
}

interface ReverseBrainstormState extends Record<string, unknown> {
  entries: ReverseEntry[];
  revealed: boolean;
}

interface ReverseBrainstormConfig {
  title?: string;
  prompt?: string;
  placeholder?: string;
}

function extractConfig(raw: Record<string, unknown>): ReverseBrainstormConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "🙃 反向腦力激盪",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "如何讓這件事變得更糟？提出一個反向觀點！",
    placeholder: typeof raw.placeholder === "string" ? raw.placeholder : "最糟糕的做法是...",
  };
}

const CARD_COLORS = [
  "bg-red-50 border-red-200 text-red-800",
  "bg-orange-50 border-orange-200 text-orange-800",
  "bg-rose-50 border-rose-200 text-rose-800",
  "bg-pink-50 border-pink-200 text-pink-800",
  "bg-amber-50 border-amber-200 text-amber-800",
];

export interface ReverseBrainstormProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ReverseBrainstorm({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: ReverseBrainstormProps) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig);

  const { state, updateState, isLoaded } = useTeamPagePersistence<ReverseBrainstormState>({
    gameId,
    sessionId,
    pageId,
    type: "reverse_brainstorm",
    defaultState: { entries: [], revealed: false },
  });

  const [badIdea, setBadIdea] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full" data-testid="rb-loading">
        <Loader2 className="animate-spin w-8 h-8 text-muted-foreground" />
      </div>
    );
  }

  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const myEntry = state.entries.find((e) => e.userId === userId);
  const canSubmit = badIdea.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit || myEntry) return;
    const entry: ReverseEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      badIdea: badIdea.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setBadIdea("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 flex flex-col gap-4 max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-2">
        <FlipHorizontal className="w-6 h-6 text-red-500" />
        <h2 className="text-xl font-bold" data-testid="rb-title">
          {cfg.title}
        </h2>
      </div>
      <p className="text-center text-muted-foreground text-sm" data-testid="rb-prompt">
        {cfg.prompt}
      </p>
      <p className="text-sm text-center text-muted-foreground" data-testid="rb-count">
        已提交：{state.entries.length} 個壞主意
      </p>

      {!myEntry && !state.revealed && (
        <div className="flex flex-col gap-2">
          <Input
            placeholder={cfg.placeholder}
            value={badIdea}
            onChange={(e) => setBadIdea(e.target.value)}
            maxLength={80}
            data-testid="rb-input"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full bg-red-500 hover:bg-red-600"
            data-testid="rb-submit-btn"
          >
            提交壞主意
          </Button>
        </div>
      )}

      {myEntry && (
        <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-sm" data-testid="rb-my-entry">
          <p className="font-bold text-red-700">🙃 {myEntry.badIdea}</p>
        </div>
      )}

      {state.revealed ? (
        <div className="flex flex-col gap-2" data-testid="rb-result">
          {state.entries.length === 0 ? (
            <p className="text-center text-muted-foreground" data-testid="rb-empty">尚無壞主意</p>
          ) : (
            state.entries.map((entry, idx) => (
              <div
                key={entry.entryId}
                data-testid={`rb-card-${entry.entryId}`}
                className={`rounded-xl border p-3 ${CARD_COLORS[idx % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium opacity-70 mb-1">{entry.userName}</p>
                <p className="font-semibold text-sm">🙃 {entry.badIdea}</p>
              </div>
            ))
          )}
        </div>
      ) : (
        isTeamLead && (
          <Button onClick={handleReveal} variant="default" className="w-full" data-testid="rb-reveal-btn">
            揭曉所有壞主意
          </Button>
        )
      )}
    </div>
  );
}

export default ReverseBrainstorm;
