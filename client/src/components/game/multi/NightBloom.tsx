import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface NightBloomEntry {
  entryId: string;
  userId: string;
  userName: string;
  bloomType: string;
  nightMessage: string;
}

interface NightBloomState extends Record<string, unknown> {
  entries: NightBloomEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: NightBloomState = { entries: [], revealed: false };

const BLOOM_TYPES = [
  { id: "moonflower", label: "月光花", icon: "🌕", desc: "月色映照，夜空盛開" },
  { id: "night_jasmine", label: "夜茉莉", icon: "🌼", desc: "暗香浮動，靜夜送情" },
  { id: "evening_primrose", label: "月見草", icon: "🌙", desc: "月升花開，邂逅美好" },
  { id: "night_orchid", label: "夜蘭", icon: "🌸", desc: "幽谷深處，獨自芬芳" },
  { id: "queen_of_night", label: "曇花", icon: "⭐", desc: "一夜盛開，轉瞬即逝" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function NightBloom({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<NightBloomState>({
    gameId,
    sessionId,
    pageId,
    type: "night_bloom",
    defaultState: DEFAULT_STATE,
  });

  const [selectedBloom, setSelectedBloom] = useState("queen_of_night");
  const [nightMessage, setNightMessage] = useState("");

  if (!isLoaded) return <div data-testid="ntb-loading">載入中...</div>;

  const title = config?.title ?? "夜間盛開";
  const prompt = config?.prompt ?? "有些花只在夜晚盛開，選一朵代表你此刻的心情";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = nightMessage.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: NightBloomEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      bloomType: selectedBloom,
      nightMessage: nightMessage.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setNightMessage("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ntb-title" className="text-2xl font-bold text-indigo-700">
        {title}
      </h2>
      <p data-testid="ntb-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ntb-count" className="text-sm text-gray-500">
        已盛開 {state.entries.length} 朵夜花
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ntb-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {BLOOM_TYPES.map((bt) => (
              <button
                key={bt.id}
                data-testid={`ntb-bloom-${bt.id}`}
                onClick={() => setSelectedBloom(bt.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedBloom === bt.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-gray-200 hover:border-indigo-300"
                }`}
              >
                <div className="text-xl">{bt.icon}</div>
                <div className="text-xs font-medium">{bt.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{bt.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ntb-message-input"
            value={nightMessage}
            onChange={(e) => setNightMessage(e.target.value)}
            placeholder="寫下夜裡你想說的話..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-indigo-400 focus:outline-none"
          />
          <button
            data-testid="ntb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-indigo-500 text-white font-semibold disabled:opacity-40"
          >
            夜裡盛開 🌙
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ntb-my-entry" className="p-4 bg-indigo-50 rounded-xl border border-indigo-200 space-y-1">
          <p className="text-sm text-indigo-600 font-medium">
            {BLOOM_TYPES.find((b) => b.id === myEntry.bloomType)?.icon}{" "}
            {BLOOM_TYPES.find((b) => b.id === myEntry.bloomType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.nightMessage}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ntb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-blue-800 text-white font-semibold"
        >
          揭曉所有夜花 🌙
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ntb-empty" className="text-center text-gray-400 py-8">
          夜色中尚無花朵盛開
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ntb-result" className="space-y-3">
          <h3 className="font-semibold text-indigo-700">所有夜花已揭曉</h3>
          {state.entries.map((entry) => {
            const bt = BLOOM_TYPES.find((b) => b.id === entry.bloomType);
            return (
              <div
                key={entry.entryId}
                data-testid={`ntb-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-indigo-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{bt?.icon}</span>
                  <span className="font-medium text-indigo-700">{bt?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.nightMessage}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
