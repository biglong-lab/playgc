import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ThoughtEntry extends Record<string, unknown> {
  entryId: string;
  userId: string;
  userName: string;
  thought: string;
}

interface ClosingThoughtState extends Record<string, unknown> {
  thoughts: ThoughtEntry[];
  revealed: boolean;
}

interface ClosingThoughtConfig {
  title?: string;
  prompt?: string;
}

function extractConfig(raw: Record<string, unknown>): ClosingThoughtConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : undefined,
    prompt: typeof raw.prompt === "string" ? raw.prompt : undefined,
  };
}

const CARD_COLORS = [
  "bg-violet-50 border-violet-200",
  "bg-sky-50 border-sky-200",
  "bg-rose-50 border-rose-200",
  "bg-emerald-50 border-emerald-200",
  "bg-amber-50 border-amber-200",
  "bg-indigo-50 border-indigo-200",
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ClosingThought({
  gameId,
  sessionId,
  pageId,
  config: rawConfig = {},
  isTeamLead,
}: Props) {
  const cfg = extractConfig(rawConfig);
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ClosingThoughtState>({
    gameId,
    sessionId,
    pageId,
    type: "closing_thought",
    defaultState: { thoughts: [], revealed: false },
  });

  const [thought, setThought] = useState("");

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8" data-testid="clt-loading">
        <Loader2 className="animate-spin w-6 h-6 text-primary" />
      </div>
    );
  }

  const userId = user?.id ?? "";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";
  const thoughts = state.thoughts as ThoughtEntry[];
  const revealed = state.revealed as boolean;
  const myEntry = thoughts.find((t) => t.userId === userId);
  const canSubmit = thought.trim().length >= 5;

  const handleSubmit = () => {
    if (!canSubmit || myEntry) return;
    const entryId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      thoughts: [...thoughts, { entryId, userId, userName, thought: thought.trim() }],
    });
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div data-testid="clt-title" className="text-xl font-bold text-center">
        {cfg.title ?? "結語時刻"}
      </div>
      <div data-testid="clt-prompt" className="text-sm text-center text-muted-foreground">
        {cfg.prompt ?? "用一段話為今天的活動畫下句點。"}
      </div>
      <div data-testid="clt-count" className="text-xs text-center text-muted-foreground">
        已有 {thoughts.length} 人分享
      </div>

      {!myEntry && (
        <div data-testid="clt-form" className="flex flex-col gap-3 bg-card rounded-xl p-4 border">
          <textarea
            data-testid="clt-thought-input"
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            placeholder="寫下你的結語（至少 5 字）"
            maxLength={120}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none"
          />
          <div className="text-xs text-right text-muted-foreground">{thought.length}/120</div>
          <button
            data-testid="clt-submit-btn"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            送出結語
          </button>
        </div>
      )}

      {myEntry && (
        <div data-testid="clt-my-entry" className="bg-violet-50 rounded-xl p-4 border border-violet-200">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquare className="w-4 h-4 text-violet-600" />
            <span className="text-sm font-semibold text-violet-700">你的結語已送出</span>
          </div>
          <p className="text-sm text-gray-700 italic">「{myEntry.thought}」</p>
        </div>
      )}

      {isTeamLead && !revealed && (
        <button
          data-testid="clt-reveal-btn"
          onClick={() => updateState({ ...state, revealed: true })}
          className="bg-violet-600 text-white rounded-lg py-2 text-sm font-medium flex items-center justify-center gap-2"
        >
          <MessageSquare className="w-4 h-4" />
          揭曉全隊結語
        </button>
      )}

      {revealed && thoughts.length === 0 && (
        <div data-testid="clt-empty" className="text-center text-muted-foreground p-8">
          還沒有人分享結語
        </div>
      )}

      {revealed && thoughts.length > 0 && (
        <div data-testid="clt-result" className="flex flex-col gap-3">
          <div className="text-sm font-semibold text-center text-violet-700">
            💬 全隊結語（{thoughts.length} 人）
          </div>
          {thoughts.map((t, idx) => (
            <div
              key={t.entryId}
              data-testid={`clt-card-${t.entryId}`}
              className={`rounded-xl p-3 border ${CARD_COLORS[idx % CARD_COLORS.length]}`}
            >
              <div className="text-xs font-medium text-muted-foreground mb-1">{t.userName}</div>
              <p className="text-sm text-gray-800 italic">「{t.thought}」</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
