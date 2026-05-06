import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WisteriaVineEntry {
  entryId: string;
  userId: string;
  userName: string;
  vineType: string;
  connection: string;
}

interface WisteriaVineState extends Record<string, unknown> {
  entries: WisteriaVineEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: WisteriaVineState = { entries: [], revealed: false };

const VINE_TYPES = [
  { id: "purple_wisteria", label: "紫藤", icon: "💜", desc: "典雅深邃，浪漫情懷" },
  { id: "white_wisteria", label: "白藤", icon: "🤍", desc: "純潔飄逸，清新脫俗" },
  { id: "pink_wisteria", label: "粉藤", icon: "🌸", desc: "溫柔可愛，春風拂面" },
  { id: "climbing_wisteria", label: "攀藤", icon: "🌿", desc: "勇往直前，向上攀爬" },
  { id: "weeping_wisteria", label: "垂藤", icon: "✨", desc: "優雅垂落，思念如絲" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function WisteriaVine({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WisteriaVineState>({
    gameId,
    sessionId,
    pageId,
    type: "wisteria_vine",
    defaultState: DEFAULT_STATE,
  });

  const [selectedVine, setSelectedVine] = useState("purple_wisteria");
  const [connection, setConnection] = useState("");

  if (!isLoaded) return <div data-testid="wst-loading">載入中...</div>;

  const title = config?.title ?? "紫藤情緣";
  const prompt = config?.prompt ?? "紫藤串串花垂落，每一串都是一段情緣，你的是哪一種？";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = connection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: WisteriaVineEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      vineType: selectedVine,
      connection: connection.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setConnection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="wst-title" className="text-2xl font-bold text-purple-700">
        {title}
      </h2>
      <p data-testid="wst-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="wst-count" className="text-sm text-gray-500">
        已編織 {state.entries.length} 段情緣
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="wst-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {VINE_TYPES.map((vt) => (
              <button
                key={vt.id}
                data-testid={`wst-vine-${vt.id}`}
                onClick={() => setSelectedVine(vt.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedVine === vt.id
                    ? "border-purple-500 bg-purple-50 text-purple-700"
                    : "border-gray-200 hover:border-purple-300"
                }`}
              >
                <div className="text-xl">{vt.icon}</div>
                <div className="text-xs font-medium">{vt.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{vt.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="wst-connection-input"
            value={connection}
            onChange={(e) => setConnection(e.target.value)}
            placeholder="寫下這段情緣的故事..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-purple-400 focus:outline-none"
          />
          <button
            data-testid="wst-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-purple-500 text-white font-semibold disabled:opacity-40"
          >
            編織情緣 💜
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="wst-my-entry" className="p-4 bg-purple-50 rounded-xl border border-purple-200 space-y-1">
          <p className="text-sm text-purple-600 font-medium">
            {VINE_TYPES.find((v) => v.id === myEntry.vineType)?.icon}{" "}
            {VINE_TYPES.find((v) => v.id === myEntry.vineType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.connection}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="wst-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-violet-600 text-white font-semibold"
        >
          揭曉所有情緣 💜
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="wst-empty" className="text-center text-gray-400 py-8">
          紫藤架下尚無情緣
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="wst-result" className="space-y-3">
          <h3 className="font-semibold text-purple-700">所有情緣已揭曉</h3>
          {state.entries.map((entry) => {
            const vt = VINE_TYPES.find((v) => v.id === entry.vineType);
            return (
              <div
                key={entry.entryId}
                data-testid={`wst-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-purple-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{vt?.icon}</span>
                  <span className="font-medium text-purple-700">{vt?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.connection}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
