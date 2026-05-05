import { useState } from "react";
import { Eye, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface VisionWord {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
}

interface TeamVisionState extends Record<string, unknown> {
  entries: VisionWord[];
  revealed: boolean;
}

interface TeamVisionConfig {
  title: string;
  prompt: string;
}

function extractConfig(raw: Record<string, unknown>): TeamVisionConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "團隊願景牆",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "用一個詞描述你心目中這個團隊未來的樣子",
  };
}

const WORD_COLORS = [
  "bg-violet-500 text-white",
  "bg-sky-500 text-white",
  "bg-teal-500 text-white",
  "bg-rose-500 text-white",
  "bg-amber-500 text-white",
  "bg-indigo-500 text-white",
  "bg-green-500 text-white",
  "bg-pink-500 text-white",
];

const WORD_SIZES = ["text-lg", "text-xl", "text-2xl", "text-base", "text-xl"];

const DEFAULT_STATE: TeamVisionState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function TeamVision({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<TeamVisionState>({
    gameId,
    sessionId,
    pageId,
    type: "team_vision",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [input, setInput] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="tv-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!input.trim()) return;
    const entry: VisionWord = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      word: input.trim().slice(0, 20),
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
        <Eye className="w-5 h-5 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="tv-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="tv-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="tv-count">已提交：{state.entries.length} 個詞</p>

      {!myEntry ? (
        <div className="space-y-2">
          <input
            data-testid="tv-input"
            className="w-full border rounded p-2 text-sm"
            placeholder="一個關鍵詞（最多 20 字）"
            maxLength={20}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            data-testid="tv-submit-btn"
            disabled={!input.trim()}
            onClick={handleSubmit}
            className="px-4 py-2 bg-violet-500 text-white rounded disabled:opacity-40 text-sm"
          >
            加入願景牆
          </button>
        </div>
      ) : (
        <div className="p-3 bg-violet-50 rounded border border-violet-200 text-sm" data-testid="tv-my-entry">
          我的詞：{myEntry.word}
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tv-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-rose-500 text-white rounded text-sm"
        >
          展示團隊願景牆
        </button>
      )}

      {state.revealed && (
        <div data-testid="tv-result">
          {state.entries.length === 0 ? (
            <p data-testid="tv-empty" className="text-gray-400 text-sm">尚無詞語</p>
          ) : (
            <div className="flex flex-wrap gap-3 justify-center">
              {state.entries.map((entry, i) => (
                <div
                  key={entry.entryId}
                  data-testid={`tv-word-${entry.entryId}`}
                  className={`rounded-lg px-4 py-2 font-bold ${WORD_COLORS[i % WORD_COLORS.length]} ${WORD_SIZES[i % WORD_SIZES.length]}`}
                  title={entry.userName}
                >
                  {entry.word}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TeamVision;
