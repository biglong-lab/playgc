import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface EchoWallEntry {
  entryId: string;
  userId: string;
  userName: string;
  echoType: string;
  echo: string;
}

interface EchoWallState extends Record<string, unknown> {
  entries: EchoWallEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: EchoWallState = { entries: [], revealed: false };

const ECHO_TYPES = [
  { id: "affirmation", label: "肯定", icon: "🔊", desc: "我想讓自己聽見" },
  { id: "memory", label: "回憶", icon: "🎵", desc: "那些值得珍藏的時刻" },
  { id: "question", label: "提問", icon: "❓", desc: "一個縈繞心頭的疑問" },
  { id: "hope", label: "希望", icon: "🌟", desc: "對未來投擲的期許" },
  { id: "lesson", label: "領悟", icon: "💡", desc: "從經歷中學到的道理" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function EchoWall({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<EchoWallState>({
    gameId,
    sessionId,
    pageId,
    type: "echo_wall",
    defaultState: DEFAULT_STATE,
  });

  const [selectedType, setSelectedType] = useState("affirmation");
  const [echo, setEcho] = useState("");

  if (!isLoaded) return <div data-testid="ecw-loading">載入中...</div>;

  const title = config?.title ?? "回音壁";
  const prompt = config?.prompt ?? "對著回音壁說話，你想讓什麼聲音回盪在這個空間？";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = echo.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: EchoWallEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      echoType: selectedType,
      echo: echo.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setEcho("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ecw-title" className="text-2xl font-bold text-indigo-700">
        {title}
      </h2>
      <p data-testid="ecw-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ecw-count" className="text-sm text-gray-500">
        已回響 {state.entries.length} 道聲音
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ecw-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {ECHO_TYPES.map((et) => (
              <button
                key={et.id}
                data-testid={`ecw-type-${et.id}`}
                onClick={() => setSelectedType(et.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedType === et.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <div className="text-xl">{et.icon}</div>
                <div className="text-xs font-medium">{et.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{et.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ecw-echo-input"
            value={echo}
            onChange={(e) => setEcho(e.target.value)}
            placeholder="讓你的聲音回響..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
          <button
            data-testid="ecw-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold disabled:opacity-40"
          >
            送出回音 🔊
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ecw-my-entry" className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-1">
          <p className="text-sm text-indigo-600 font-medium">
            {ECHO_TYPES.find((t) => t.id === myEntry.echoType)?.icon}{" "}
            {ECHO_TYPES.find((t) => t.id === myEntry.echoType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.echo}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ecw-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-violet-500 text-white font-semibold"
        >
          揭曉所有回音 🎶
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ecw-empty" className="text-center text-gray-400 py-8">
          回音壁寂靜無聲
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ecw-result" className="space-y-3">
          <h3 className="font-semibold text-indigo-700">所有回音已揭曉</h3>
          {state.entries.map((entry) => {
            const et = ECHO_TYPES.find((t) => t.id === entry.echoType);
            return (
              <div
                key={entry.entryId}
                data-testid={`ecw-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-indigo-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{et?.icon}</span>
                  <span className="font-medium text-indigo-700">{et?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.echo}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
