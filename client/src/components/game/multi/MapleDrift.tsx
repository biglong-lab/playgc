import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MapleDriftEntry {
  entryId: string;
  userId: string;
  userName: string;
  mapleColor: string;
  driftMeaning: string;
}

interface MapleDriftState extends Record<string, unknown> {
  entries: MapleDriftEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: MapleDriftState = { entries: [], revealed: false };

const MAPLE_COLORS = [
  { id: "crimson_maple", label: "緋紅楓", icon: "🍁", desc: "熱烈奔放，燃燒激情" },
  { id: "golden_maple", label: "金黃楓", icon: "🌕", desc: "豐收圓滿，成熟智慧" },
  { id: "amber_maple", label: "琥珀楓", icon: "🟠", desc: "溫暖珍貴，時光留存" },
  { id: "russet_maple", label: "棕紅楓", icon: "🍂", desc: "沉穩厚重，歲月積澱" },
  { id: "green_maple", label: "嫩綠楓", icon: "🌿", desc: "清新生機，萌芽希望" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function MapleDrift({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MapleDriftState>({
    gameId,
    sessionId,
    pageId,
    type: "maple_drift",
    defaultState: DEFAULT_STATE,
  });

  const [selectedMaple, setSelectedMaple] = useState("crimson_maple");
  const [driftMeaning, setDriftMeaning] = useState("");

  if (!isLoaded) return <div data-testid="mpd-loading">載入中...</div>;

  const title = config?.title ?? "楓葉飄落";
  const prompt = config?.prompt ?? "一片楓葉輕輕落在你掌心，它代表你此刻的心情";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = driftMeaning.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: MapleDriftEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      mapleColor: selectedMaple,
      driftMeaning: driftMeaning.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setDriftMeaning("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="mpd-title" className="text-2xl font-bold text-orange-700">
        {title}
      </h2>
      <p data-testid="mpd-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="mpd-count" className="text-sm text-gray-500">
        已飄落 {state.entries.length} 片楓葉
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="mpd-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {MAPLE_COLORS.map((mc) => (
              <button
                key={mc.id}
                data-testid={`mpd-maple-${mc.id}`}
                onClick={() => setSelectedMaple(mc.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedMaple === mc.id
                    ? "border-orange-500 bg-orange-50 text-orange-700"
                    : "border-gray-200 hover:border-orange-300"
                }`}
              >
                <div className="text-xl">{mc.icon}</div>
                <div className="text-xs font-medium">{mc.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{mc.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="mpd-drift-input"
            value={driftMeaning}
            onChange={(e) => setDriftMeaning(e.target.value)}
            placeholder="寫下這片楓葉帶給你的感觸..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-orange-400 focus:outline-none"
          />
          <button
            data-testid="mpd-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold disabled:opacity-40"
          >
            隨風飄落 🍁
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="mpd-my-entry" className="p-4 bg-orange-50 rounded-xl border border-orange-200 space-y-1">
          <p className="text-sm text-orange-600 font-medium">
            {MAPLE_COLORS.find((m) => m.id === myEntry.mapleColor)?.icon}{" "}
            {MAPLE_COLORS.find((m) => m.id === myEntry.mapleColor)?.label}
          </p>
          <p className="text-gray-700">{myEntry.driftMeaning}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="mpd-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-red-600 text-white font-semibold"
        >
          揭曉所有楓葉 🍁
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="mpd-empty" className="text-center text-gray-400 py-8">
          秋風中尚無楓葉飄落
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="mpd-result" className="space-y-3">
          <h3 className="font-semibold text-orange-700">所有楓葉已揭曉</h3>
          {state.entries.map((entry) => {
            const mc = MAPLE_COLORS.find((m) => m.id === entry.mapleColor);
            return (
              <div
                key={entry.entryId}
                data-testid={`mpd-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-orange-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{mc?.icon}</span>
                  <span className="font-medium text-orange-700">{mc?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.driftMeaning}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
