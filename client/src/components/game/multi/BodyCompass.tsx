import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BodyCompassEntry {
  entryId: string;
  userId: string;
  userName: string;
  region: string;
  sensation: string;
}

interface BodyCompassState extends Record<string, unknown> {
  entries: BodyCompassEntry[];
  revealed: boolean;
}

interface BodyCompassConfig {
  title?: string;
  prompt?: string;
}

interface BodyCompassProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: BodyCompassConfig;
}

const REGIONS = [
  { id: "head", label: "頭部", icon: "🧠", desc: "思緒、念頭" },
  { id: "chest", label: "胸口", icon: "❤️", desc: "心情、情感" },
  { id: "belly", label: "腹部", icon: "🌀", desc: "直覺、感受" },
  { id: "hands", label: "雙手", icon: "🤲", desc: "行動力" },
  { id: "feet", label: "雙腳", icon: "👣", desc: "穩定、根基" },
  { id: "whole", label: "全身", icon: "✨", desc: "整體感" },
];

const CARD_COLORS = [
  "bg-cyan-50 border-cyan-200",
  "bg-teal-50 border-teal-200",
  "bg-sky-50 border-sky-200",
  "bg-blue-50 border-blue-200",
  "bg-indigo-50 border-indigo-200",
  "bg-violet-50 border-violet-200",
];

export function BodyCompass({ gameId, sessionId, pageId, isTeamLead, config }: BodyCompassProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BodyCompassState>({
    gameId,
    sessionId,
    pageId,
    type: "body_compass",
    defaultState: { entries: [], revealed: false },
  });

  const [region, setRegion] = useState("chest");
  const [sensation, setSensation] = useState("");

  if (!isLoaded) return <div data-testid="bdc-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = sensation.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: BodyCompassEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      region,
      sensation: sensation.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedRegion = REGIONS.find((r) => r.id === region)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="bdc-title" className="text-xl font-bold text-teal-700 text-center">
        {config?.title ?? "身體羅盤"}
      </h2>
      <p data-testid="bdc-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "此刻，你的身體哪個部位最有感覺？"}
      </p>
      <p data-testid="bdc-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="bdc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊身體羅盤
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="bdc-form" className="space-y-3 bg-teal-50 rounded-xl p-4">
          <div data-testid="bdc-region-grid" className="grid grid-cols-3 gap-2">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                data-testid={`bdc-region-${r.id}`}
                onClick={() => setRegion(r.id)}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-colors ${
                  region === r.id
                    ? "bg-teal-100 border-teal-400"
                    : "bg-white border-gray-200 hover:border-teal-200"
                }`}
              >
                <span className="text-2xl">{r.icon}</span>
                <p className="text-xs font-medium text-gray-700">{r.label}</p>
                <p className="text-xs text-gray-400">{r.desc}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-teal-700 font-medium mb-1">
              {selectedRegion.icon} {selectedRegion.label}有什麼感受？
            </label>
            <input
              data-testid="bdc-sensation-input"
              type="text"
              value={sensation}
              onChange={(e) => setSensation(e.target.value)}
              placeholder="描述你感受到的..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            data-testid="bdc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-teal-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            完成感應
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="bdc-my-entry" className="p-4 rounded-xl border-2 bg-teal-50 border-teal-300 space-y-1">
          <p className="text-sm font-medium text-teal-700">
            {REGIONS.find((r) => r.id === myEntry.region)?.icon}{" "}
            {REGIONS.find((r) => r.id === myEntry.region)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.sensation}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="bdc-empty" className="text-center text-gray-400 py-8">還沒有人完成身體羅盤</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="bdc-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const rgn = REGIONS.find((r) => r.id === e.region);
            return (
              <div
                key={e.entryId}
                data-testid={`bdc-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{rgn?.icon} {rgn?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.sensation}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
