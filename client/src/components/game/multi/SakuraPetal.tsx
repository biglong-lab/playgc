import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface SakuraPetalEntry {
  entryId: string;
  userId: string;
  userName: string;
  petalMeaning: string;
  feeling: string;
}

interface SakuraPetalState extends Record<string, unknown> {
  entries: SakuraPetalEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: SakuraPetalState = { entries: [], revealed: false };

const PETAL_MEANINGS = [
  { id: "transience", label: "無常", icon: "🌸", desc: "美麗的事物都是短暫的" },
  { id: "beauty", label: "美麗", icon: "💮", desc: "每個當下都值得珍視" },
  { id: "renewal", label: "更新", icon: "🌺", desc: "凋謝後又重新綻放" },
  { id: "joy", label: "喜悅", icon: "🎀", desc: "滿樹花開的雀躍心情" },
  { id: "farewell", label: "告別", icon: "🍃", desc: "隨風飄落的溫柔道別" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function SakuraPetal({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<SakuraPetalState>({
    gameId,
    sessionId,
    pageId,
    type: "sakura_petal",
    defaultState: DEFAULT_STATE,
  });

  const [selectedMeaning, setSelectedMeaning] = useState("transience");
  const [feeling, setFeeling] = useState("");

  if (!isLoaded) return <div data-testid="skp-loading">載入中...</div>;

  const title = config?.title ?? "櫻花瓣";
  const prompt = config?.prompt ?? "一片花瓣飄落在你手心，它帶給你什麼樣的心情？";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = feeling.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: SakuraPetalEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      petalMeaning: selectedMeaning,
      feeling: feeling.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setFeeling("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="skp-title" className="text-2xl font-bold text-pink-600">
        {title}
      </h2>
      <p data-testid="skp-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="skp-count" className="text-sm text-gray-500">
        已飄落 {state.entries.length} 片花瓣
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="skp-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {PETAL_MEANINGS.map((pm) => (
              <button
                key={pm.id}
                data-testid={`skp-meaning-${pm.id}`}
                onClick={() => setSelectedMeaning(pm.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedMeaning === pm.id
                    ? "border-pink-500 bg-pink-50 text-pink-700"
                    : "border-gray-200 hover:border-pink-300"
                }`}
              >
                <div className="text-xl">{pm.icon}</div>
                <div className="text-xs font-medium">{pm.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{pm.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="skp-feeling-input"
            value={feeling}
            onChange={(e) => setFeeling(e.target.value)}
            placeholder="寫下花瓣帶給你的感受..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-pink-400 focus:outline-none"
          />
          <button
            data-testid="skp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-pink-500 text-white font-semibold disabled:opacity-40"
          >
            放開花瓣 🌸
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="skp-my-entry" className="p-4 bg-pink-50 rounded-xl border border-pink-200 space-y-1">
          <p className="text-sm text-pink-600 font-medium">
            {PETAL_MEANINGS.find((p) => p.id === myEntry.petalMeaning)?.icon}{" "}
            {PETAL_MEANINGS.find((p) => p.id === myEntry.petalMeaning)?.label}
          </p>
          <p className="text-gray-700">{myEntry.feeling}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="skp-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-rose-500 text-white font-semibold"
        >
          揭曉所有花瓣 🌸
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="skp-empty" className="text-center text-gray-400 py-8">
          尚無花瓣飄落
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="skp-result" className="space-y-3">
          <h3 className="font-semibold text-pink-600">所有花瓣已揭曉</h3>
          {state.entries.map((entry) => {
            const pm = PETAL_MEANINGS.find((p) => p.id === entry.petalMeaning);
            return (
              <div
                key={entry.entryId}
                data-testid={`skp-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-pink-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{pm?.icon}</span>
                  <span className="font-medium text-pink-600">{pm?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.feeling}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
