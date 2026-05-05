import { useState } from "react";
import { Rocket, Loader2 } from "lucide-react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FutureMeEntry {
  entryId: string;
  userId: string;
  userName: string;
  horizon: string;
  message: string;
}

interface FutureMeState extends Record<string, unknown> {
  entries: FutureMeEntry[];
  revealed: boolean;
}

interface FutureMeConfig {
  title: string;
  prompt: string;
  horizons: string[];
}

function extractConfig(raw: Record<string, unknown>): FutureMeConfig {
  return {
    title: typeof raw.title === "string" ? raw.title : "給未來的我",
    prompt: typeof raw.prompt === "string" ? raw.prompt : "寫一段話給未來的自己，或許是一個提醒，也或許是一個承諾。",
    horizons: Array.isArray(raw.horizons)
      ? (raw.horizons as string[])
      : ["1 年後", "3 年後", "5 年後"],
  };
}

const HORIZON_COLORS: Record<string, string> = {
  "1 年後": "bg-sky-100 text-sky-700 border-sky-300",
  "3 年後": "bg-violet-100 text-violet-700 border-violet-300",
  "5 年後": "bg-amber-100 text-amber-700 border-amber-300",
};

const DEFAULT_STATE: FutureMeState = { entries: [], revealed: false };

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  config?: Record<string, unknown>;
  isTeamLead?: boolean;
}

export function FutureMe({ gameId, sessionId, pageId, config: rawConfig = {}, isTeamLead }: Props) {
  const { state, updateState, isLoaded } = useTeamPagePersistence<FutureMeState>({
    gameId,
    sessionId,
    pageId,
    type: "future_me",
    defaultState: DEFAULT_STATE,
  });
  const { user } = useAuth();
  const [horizon, setHorizon] = useState("");
  const [message, setMessage] = useState("");

  if (!isLoaded) return <Loader2 className="animate-spin" data-testid="fm-loading" />;

  const cfg = extractConfig(rawConfig);
  const userId = user?.id ?? user?.email?.split("@")[0] ?? "anon";
  const userName = user?.firstName ?? user?.email?.split("@")[0] ?? "玩家";

  const myEntry = state.entries.find((e) => e.userId === userId);

  function handleSubmit() {
    if (!horizon || message.trim().length < 5) return;
    const entry: FutureMeEntry = {
      entryId: `${userId}-${Date.now()}`,
      userId,
      userName,
      horizon,
      message: message.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const horizonClass = (h: string) =>
    HORIZON_COLORS[h] ?? "bg-gray-100 text-gray-700 border-gray-300";

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Rocket className="w-5 h-5 text-violet-500" />
        <h2 className="text-xl font-bold" data-testid="fm-title">{cfg.title}</h2>
      </div>
      <p className="text-sm text-gray-600" data-testid="fm-prompt">{cfg.prompt}</p>
      <p className="text-xs text-gray-400" data-testid="fm-count">已寫信：{state.entries.length} 人</p>

      {!myEntry ? (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap" data-testid="fm-horizons">
            {cfg.horizons.map((h) => (
              <button
                key={h}
                data-testid={`fm-horizon-${h}`}
                onClick={() => setHorizon(h)}
                className={`px-3 py-1 rounded-full border text-sm font-medium transition-shadow ${
                  horizon === h
                    ? `${horizonClass(h)} ring-2 ring-offset-1 ring-violet-400`
                    : "bg-gray-50 text-gray-500 border-gray-200"
                }`}
              >
                {h}
              </button>
            ))}
          </div>
          <textarea
            data-testid="fm-textarea"
            className="w-full border rounded p-2 text-sm resize-none h-28"
            placeholder="親愛的未來的我..."
            maxLength={200}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <p className="text-xs text-gray-400 text-right">{message.length}/200</p>
          <button
            data-testid="fm-submit-btn"
            disabled={!horizon || message.trim().length < 5}
            onClick={handleSubmit}
            className="px-4 py-2 bg-violet-500 text-white rounded disabled:opacity-40 text-sm"
          >
            送出信件
          </button>
        </div>
      ) : (
        <div className="p-3 bg-violet-50 rounded border border-violet-200 text-sm space-y-1" data-testid="fm-my-entry">
          <span className={`px-2 py-0.5 rounded-full border text-xs ${horizonClass(myEntry.horizon)}`}>
            {myEntry.horizon}
          </span>
          <p className="text-gray-700 mt-1 italic">"{myEntry.message}"</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="fm-reveal-btn"
          onClick={handleReveal}
          className="px-4 py-2 bg-green-500 text-white rounded text-sm"
        >
          開啟信件箱
        </button>
      )}

      {state.revealed && (
        <div data-testid="fm-result" className="space-y-3">
          <p className="text-sm font-semibold text-gray-600">所有人的信</p>
          {state.entries.length === 0 ? (
            <p data-testid="fm-empty" className="text-gray-400 text-sm">尚無信件</p>
          ) : (
            <div className="space-y-3">
              {state.entries.map((entry) => (
                <div
                  key={entry.entryId}
                  data-testid={`fm-card-${entry.entryId}`}
                  className="bg-white rounded-lg border p-3 space-y-1 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">{entry.userName}</span>
                    <span className={`px-2 py-0.5 rounded-full border text-xs ${horizonClass(entry.horizon)}`}>
                      {entry.horizon}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 italic">"{entry.message}"</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default FutureMe;
