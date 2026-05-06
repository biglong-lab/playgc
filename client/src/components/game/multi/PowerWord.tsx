import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface PowerWordEntry {
  entryId: string;
  userId: string;
  userName: string;
  word: string;
  reason: string;
}

interface PowerWordState extends Record<string, unknown> {
  words: PowerWordEntry[];
  revealed: boolean;
}

interface PowerWordConfig {
  title?: string;
  prompt?: string;
}

interface PowerWordProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: PowerWordConfig;
}

const POWER_WORDS = ["勇氣", "智慧", "創新", "協作", "堅持", "溫柔", "熱情", "專注", "包容", "成長", "突破", "連結"];

const CARD_COLORS = [
  "bg-amber-100 border-amber-400 text-amber-800",
  "bg-orange-100 border-orange-400 text-orange-800",
  "bg-yellow-100 border-yellow-400 text-yellow-800",
  "bg-lime-100 border-lime-400 text-lime-800",
  "bg-emerald-100 border-emerald-400 text-emerald-800",
  "bg-sky-100 border-sky-400 text-sky-800",
];

export function PowerWord({ gameId, sessionId, pageId, isTeamLead, config }: PowerWordProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<PowerWordState>({
    gameId,
    sessionId,
    pageId,
    type: "power_word",
    defaultState: { words: [], revealed: false },
  });

  const [selectedWord, setSelectedWord] = useState(POWER_WORDS[0]);
  const [reason, setReason] = useState("");

  if (!isLoaded) return <div data-testid="pwr-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.words.find((w) => w.userId === user?.id);
  const canSubmit = reason.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: PowerWordEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      word: selectedWord,
      reason: reason.trim(),
    };
    updateState({ ...state, words: [...state.words, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="pwr-title" className="text-xl font-bold text-amber-700 text-center">
        {config?.title ?? "力量之詞"}
      </h2>
      <p data-testid="pwr-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "選一個最能代表你今天狀態的力量詞語，並說明原因"}
      </p>
      <p data-testid="pwr-count" className="text-xs text-gray-400 text-center">
        已分享：{state.words.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="pwr-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊力量詞
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="pwr-form" className="space-y-3 bg-amber-50 rounded-xl p-4">
          <div data-testid="pwr-word-grid" className="grid grid-cols-4 gap-2">
            {POWER_WORDS.map((w) => (
              <button
                key={w}
                data-testid={`pwr-word-${w}`}
                onClick={() => setSelectedWord(w)}
                className={`py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                  selectedWord === w
                    ? "bg-amber-200 border-amber-500 text-amber-800"
                    : "bg-white border-gray-200 text-gray-600"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <input
            data-testid="pwr-reason-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="為什麼這個詞最能代表你今天？"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            data-testid="pwr-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-amber-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享力量詞
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="pwr-my-entry" className="p-4 rounded-xl border-2 bg-amber-100 border-amber-400">
          <p className="font-bold text-amber-800 text-lg">{myEntry.word}</p>
          <p className="text-xs text-amber-700 mt-1">{myEntry.reason}</p>
        </div>
      )}

      {state.revealed && state.words.length === 0 && (
        <div data-testid="pwr-empty" className="text-center text-gray-400 py-8">還沒有人分享力量詞</div>
      )}

      {state.revealed && state.words.length > 0 && (
        <div data-testid="pwr-result" className="grid grid-cols-2 gap-3">
          {state.words.map((w, i) => (
            <div
              key={w.entryId}
              data-testid={`pwr-card-${w.entryId}`}
              className={`p-3 rounded-xl border-2 ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <p className="text-xs font-medium opacity-70">{w.userName}</p>
              <p className="font-bold text-lg">{w.word}</p>
              <p className="text-xs mt-1 opacity-80">{w.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
