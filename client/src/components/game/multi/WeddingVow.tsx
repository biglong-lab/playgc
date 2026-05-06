import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WeddingVowEntry {
  entryId: string;
  userId: string;
  userName: string;
  theme: string;
  blessing: string;
}

interface WeddingVowState extends Record<string, unknown> {
  entries: WeddingVowEntry[];
  revealed: boolean;
}

interface WeddingVowConfig {
  title?: string;
  prompt?: string;
}

interface WeddingVowProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: WeddingVowConfig;
}

const THEMES = [
  { id: "love", label: "愛情", icon: "💑", desc: "攜手相愛" },
  { id: "adventure", label: "冒險", icon: "🌟", desc: "勇闖天涯" },
  { id: "growth", label: "成長", icon: "🌱", desc: "共同進步" },
  { id: "peace", label: "平靜", icon: "🕊️", desc: "歲月靜好" },
  { id: "prosperity", label: "豐盛", icon: "🌈", desc: "圓滿幸福" },
];

const CARD_COLORS = [
  "bg-pink-50 border-pink-200",
  "bg-rose-50 border-rose-200",
  "bg-red-50 border-red-200",
  "bg-fuchsia-50 border-fuchsia-200",
  "bg-purple-50 border-purple-200",
];

export function WeddingVow({ gameId, sessionId, pageId, isTeamLead, config }: WeddingVowProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WeddingVowState>({
    gameId,
    sessionId,
    pageId,
    type: "wedding_vow",
    defaultState: { entries: [], revealed: false },
  });

  const [theme, setTheme] = useState("love");
  const [blessing, setBlessing] = useState("");

  if (!isLoaded) return <div data-testid="wdv-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = blessing.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: WeddingVowEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "賓客",
      theme,
      blessing: blessing.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedTheme = THEMES.find((t) => t.id === theme)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="wdv-title" className="text-xl font-bold text-pink-700 text-center">
        {config?.title ?? "婚禮祝福卡"}
      </h2>
      <p data-testid="wdv-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "為這對新人送上你最真摯的祝福！"}
      </p>
      <p data-testid="wdv-count" className="text-xs text-gray-400 text-center">
        已送出祝福：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="wdv-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-pink-600 text-white rounded-lg text-sm font-medium"
        >
          開啟祝福信箱
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="wdv-form" className="space-y-3 bg-pink-50 rounded-xl p-4">
          <div data-testid="wdv-theme-grid" className="grid grid-cols-5 gap-2">
            {THEMES.map((t) => (
              <button
                key={t.id}
                data-testid={`wdv-theme-${t.id}`}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors ${
                  theme === t.id
                    ? "bg-pink-100 border-pink-400"
                    : "bg-white border-gray-200 hover:border-pink-200"
                }`}
              >
                <span className="text-xl">{t.icon}</span>
                <span className="text-xs text-gray-600">{t.label}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-pink-700 font-medium mb-1">
              {selectedTheme.icon} 我的{selectedTheme.label}祝福：
            </label>
            <textarea
              data-testid="wdv-blessing-input"
              value={blessing}
              onChange={(e) => setBlessing(e.target.value)}
              placeholder="寫下你對這對新人的祝福..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <button
            data-testid="wdv-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-pink-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            送出祝福 💒
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="wdv-my-entry" className="p-4 rounded-xl border-2 bg-pink-50 border-pink-300 space-y-1">
          <p className="text-sm font-medium text-pink-700">
            {THEMES.find((t) => t.id === myEntry.theme)?.icon}{" "}
            {THEMES.find((t) => t.id === myEntry.theme)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.blessing}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="wdv-empty" className="text-center text-gray-400 py-8">還沒有人送出祝福</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="wdv-result" className="space-y-2">
          <p className="text-center text-pink-600 text-sm font-medium">
            💒 共收到 {state.entries.length} 份祝福
          </p>
          {state.entries.map((e, i) => {
            const thm = THEMES.find((t) => t.id === e.theme);
            return (
              <div
                key={e.entryId}
                data-testid={`wdv-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-xs font-medium text-pink-600 mb-1">{thm?.icon} {thm?.label}</p>
                <p className="text-sm text-gray-700 italic">「{e.blessing}」</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
