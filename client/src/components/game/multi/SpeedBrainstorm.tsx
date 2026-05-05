import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { Loader2 } from "lucide-react";

export interface BrainstormIdea extends Record<string, unknown> {
  ideaId: string;
  userId: string;
  userName: string;
  text: string;
}

export interface SpeedBrainstormConfig extends Record<string, unknown> {
  title: string;
  prompt: string;
  timerSeconds: number;
  maxIdeas: number;
  maxLength: number;
}

export interface SpeedBrainstormState extends Record<string, unknown> {
  ideas: BrainstormIdea[];
  startedAt: number | null;
  revealed: boolean;
}

function extractConfig(raw: Record<string, unknown>): SpeedBrainstormConfig {
  return {
    title: (raw.title as string) || "快速腦力激盪",
    prompt: (raw.prompt as string) || "在時間內盡量提出想法！",
    timerSeconds: (raw.timerSeconds as number) ?? 60,
    maxIdeas: (raw.maxIdeas as number) ?? 5,
    maxLength: (raw.maxLength as number) ?? 40,
  };
}

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function SpeedBrainstorm({ gameId, sessionId, pageId, config: rawConfig, isTeamLead }: Props) {
  const { user } = useAuth();
  const cfg = extractConfig(rawConfig ?? {});
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "匿名";

  const defaultState: SpeedBrainstormState = { ideas: [], startedAt: null, revealed: false };
  const { state, updateState, isLoaded } = useTeamPagePersistence<SpeedBrainstormState>({
    gameId,
    sessionId,
    pageId,
    type: "speed_brainstorm",
    defaultState,
  });

  const [input, setInput] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin" data-testid="sb-loading" />
      </div>
    );
  }

  const isRunning = state.startedAt !== null && !state.revealed;
  const durationMs = cfg.timerSeconds * 1000;
  const elapsed = isRunning ? now - (state.startedAt as number) : 0;
  const remaining = Math.max(0, durationMs - elapsed);
  const isExpired = state.startedAt !== null && remaining === 0 && !state.revealed;

  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  const timeLabel = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  const myIdeas = state.ideas.filter((i) => i.userId === userId);
  const canAddMore = myIdeas.length < cfg.maxIdeas;

  function handleStart() {
    updateState({ ...state, startedAt: Date.now() });
  }

  function handleAddIdea() {
    if (!input.trim() || !canAddMore || (!isRunning && !isExpired)) return;
    if (!isRunning && !isExpired) return;
    const ideaId = `${userId}-${Date.now()}`;
    updateState({
      ...state,
      ideas: [...state.ideas, { ideaId, userId, userName, text: input.trim() }],
    });
    setInput("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const colors = [
    "bg-yellow-100 border-yellow-300",
    "bg-blue-100 border-blue-300",
    "bg-green-100 border-green-300",
    "bg-pink-100 border-pink-300",
    "bg-purple-100 border-purple-300",
    "bg-orange-100 border-orange-300",
  ];

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold" data-testid="sb-title">{cfg.title}</h2>
      <p className="text-gray-600" data-testid="sb-prompt">{cfg.prompt}</p>
      <p className="text-sm text-gray-500" data-testid="sb-count">
        共 {state.ideas.length} 個想法 · 我 {myIdeas.length}/{cfg.maxIdeas}
      </p>

      {!state.startedAt && isTeamLead && (
        <button
          className="px-4 py-2 bg-orange-500 text-white rounded font-semibold"
          onClick={handleStart}
          data-testid="sb-start-btn"
        >
          ▶ 開始 ({cfg.timerSeconds} 秒)
        </button>
      )}

      {state.startedAt && !state.revealed && (
        <div className={`text-center py-2 rounded font-mono text-2xl font-bold ${isExpired ? "text-red-500" : "text-green-600"}`}
          data-testid="sb-timer">
          {isExpired ? "時間到！" : timeLabel}
        </div>
      )}

      {(isRunning || isExpired) && !state.revealed && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 border rounded px-3 py-2"
              placeholder="輸入一個想法..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddIdea()}
              disabled={!canAddMore}
              data-testid="sb-input"
              maxLength={cfg.maxLength}
            />
            <button
              className="px-3 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
              disabled={!input.trim() || !canAddMore}
              onClick={handleAddIdea}
              data-testid="sb-add-btn"
            >
              +
            </button>
          </div>
          {myIdeas.length > 0 && (
            <div data-testid="sb-my-ideas">
              {myIdeas.map((idea) => (
                <span key={idea.ideaId} className="inline-block mr-1 text-xs bg-blue-50 border border-blue-200 rounded px-2 py-1 mt-1">
                  {idea.text}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {isTeamLead && (isExpired || (state.startedAt && !state.revealed)) && (
        <button
          className="px-4 py-2 bg-green-600 text-white rounded"
          onClick={handleReveal}
          data-testid="sb-reveal-btn"
        >
          揭曉所有想法
        </button>
      )}

      {state.revealed && (
        <div data-testid="sb-result">
          <h3 className="font-semibold mb-3">💡 全隊想法牆（{state.ideas.length} 個）</h3>
          {state.ideas.length === 0 ? (
            <p className="text-gray-400 text-center py-4" data-testid="sb-empty">沒有提交任何想法</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {state.ideas.map((idea, idx) => (
                <div
                  key={idea.ideaId}
                  className={`p-3 rounded border ${colors[idx % colors.length]}`}
                  data-testid={`sb-idea-${idea.ideaId}`}
                >
                  <p className="text-sm">{idea.text}</p>
                  <p className="text-xs text-gray-500 mt-1">{idea.userName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SpeedBrainstorm;
