import { useState } from "react";
import { Cloud, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BubbleEntry {
  entryId: string;
  userId: string;
  userName: string;
  thought: string;
}

interface ThoughtBubbleState extends Record<string, unknown> {
  entries: BubbleEntry[];
  revealed: boolean;
}

interface ThoughtBubbleConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): ThoughtBubbleConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "思緒泡泡",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "現在你腦海中最想說的一句話是什麼？",
  };
}

const BUBBLE_COLORS = [
  "bg-sky-100 border-sky-300 text-sky-800",
  "bg-violet-100 border-violet-300 text-violet-800",
  "bg-teal-100 border-teal-300 text-teal-800",
  "bg-rose-100 border-rose-300 text-rose-800",
  "bg-amber-100 border-amber-300 text-amber-800",
];

const DEFAULT_STATE: ThoughtBubbleState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function ThoughtBubble({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<ThoughtBubbleState>({
    gameId,
    sessionId,
    pageId,
    type: "thought_bubble",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [input, setInput] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tb-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!input.trim()) return;
    const entry: BubbleEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      thought: input.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setInput("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Cloud className="w-5 h-5 text-sky-500" />
        <h2 className="text-xl font-bold" data-testid="tb-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tb-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="tb-count">已分享：{state.entries.length} 個想法</p>

      {!myEntry ? (
        <div className="space-y-2">
          <input
            data-testid="tb-input"
            className="w-full border rounded-full p-3 text-sm bg-gray-50"
            placeholder="輸入你的想法（最多 80 字）"
            maxLength={80}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            data-testid="tb-submit-btn"
            disabled={!input.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 bg-sky-500 text-white rounded-full disabled:opacity-40 text-sm"
          >
            放出泡泡
          </button>
        </div>
      ) : (
        <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 text-sm" data-testid="tb-my-entry">
          我的泡泡：{myEntry.thought}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tb-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-violet-500 text-white rounded text-sm"
        >
          展示所有泡泡
        </button>
      )}

      {state.revealed && (
        <div data-testid="tb-result">
          {state.entries.length === 0 ? (
            <p data-testid="tb-empty" className="text-gray-400 text-sm">尚無想法</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`tb-bubble-${entry.entryId}`}
                  className={`rounded-2xl border px-4 py-3 max-w-xs ${BUBBLE_COLORS[i % BUBBLE_COLORS.length]}`}
                >
                  <p className="text-xs font-semibold mb-1">{entry.userName}</p>
                  <p className="text-sm">{entry.thought}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ThoughtBubble;
