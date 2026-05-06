import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LanternFloatEntry {
  entryId: string;
  userId: string;
  userName: string;
  lanternType: string;
  prayer: string;
}

interface LanternFloatState extends Record<string, unknown> {
  entries: LanternFloatEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: LanternFloatState = { entries: [], revealed: false };

const LANTERN_TYPES = [
  { id: "hope_lantern", label: "希望燈", icon: "🏮", desc: "點亮希望，照亮前路" },
  { id: "memory_lantern", label: "記憶燈", icon: "🕯️", desc: "承載記憶，永不熄滅" },
  { id: "love_lantern", label: "愛燈", icon: "💛", desc: "傳遞愛意，溫暖人心" },
  { id: "dream_lantern", label: "夢想燈", icon: "⭐", desc: "追逐夢想，越飛越高" },
  { id: "prayer_lantern", label: "祈願燈", icon: "🙏", desc: "心誠則靈，願望成真" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function LanternFloat({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LanternFloatState>({
    gameId,
    sessionId,
    pageId,
    type: "lantern_float",
    defaultState: DEFAULT_STATE,
  });

  const [selectedLantern, setSelectedLantern] = useState("hope_lantern");
  const [prayer, setPrayer] = useState("");

  if (!isLoaded) return <div data-testid="ltf-loading">載入中...</div>;

  const title = config?.title ?? "天燈祈願";
  const prompt = config?.prompt ?? "點亮一盞天燈，讓它帶著你的祈願飛向天際";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = prayer.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: LanternFloatEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      lanternType: selectedLantern,
      prayer: prayer.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setPrayer("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ltf-title" className="text-2xl font-bold text-amber-700">
        {title}
      </h2>
      <p data-testid="ltf-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ltf-count" className="text-sm text-gray-500">
        已放飛 {state.entries.length} 盞天燈
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ltf-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {LANTERN_TYPES.map((lt) => (
              <button
                key={lt.id}
                data-testid={`ltf-lantern-${lt.id}`}
                onClick={() => setSelectedLantern(lt.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedLantern === lt.id
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 hover:border-amber-300"
                }`}
              >
                <div className="text-xl">{lt.icon}</div>
                <div className="text-xs font-medium">{lt.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{lt.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ltf-prayer-input"
            value={prayer}
            onChange={(e) => setPrayer(e.target.value)}
            placeholder="寫下你的祈願，讓天燈帶往遠方..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-amber-400 focus:outline-none"
          />
          <button
            data-testid="ltf-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-amber-500 text-white font-semibold disabled:opacity-40"
          >
            放飛天燈 🏮
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ltf-my-entry" className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
          <p className="text-sm text-amber-600 font-medium">
            {LANTERN_TYPES.find((l) => l.id === myEntry.lanternType)?.icon}{" "}
            {LANTERN_TYPES.find((l) => l.id === myEntry.lanternType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.prayer}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ltf-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-orange-600 text-white font-semibold"
        >
          揭曉所有祈願 🏮
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ltf-empty" className="text-center text-gray-400 py-8">
          夜空中尚無天燈
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ltf-result" className="space-y-3">
          <h3 className="font-semibold text-amber-700">所有祈願已揭曉</h3>
          {state.entries.map((entry) => {
            const lt = LANTERN_TYPES.find((l) => l.id === entry.lanternType);
            return (
              <div
                key={entry.entryId}
                data-testid={`ltf-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-amber-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{lt?.icon}</span>
                  <span className="font-medium text-amber-700">{lt?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.prayer}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
