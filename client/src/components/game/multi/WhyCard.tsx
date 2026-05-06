import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface WhyCardEntry {
  entryId: string;
  userId: string;
  userName: string;
  why: string;
}

interface WhyCardState extends Record<string, unknown> {
  cards: WhyCardEntry[];
  revealed: boolean;
}

interface WhyCardConfig {
  title?: string;
  prompt?: string;
}

interface WhyCardProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: WhyCardConfig;
}

const CARD_COLORS = [
  "bg-rose-50 border-rose-300 text-rose-800",
  "bg-amber-50 border-amber-300 text-amber-800",
  "bg-sky-50 border-sky-300 text-sky-800",
  "bg-violet-50 border-violet-300 text-violet-800",
  "bg-emerald-50 border-emerald-300 text-emerald-800",
  "bg-orange-50 border-orange-300 text-orange-800",
];

export function WhyCard({ gameId, sessionId, pageId, isTeamLead, config }: WhyCardProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<WhyCardState>({
    gameId,
    sessionId,
    pageId,
    type: "why_card",
    defaultState: { cards: [], revealed: false },
  });

  const [why, setWhy] = useState("");

  if (!isLoaded) return <div data-testid="why-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.cards.find((c) => c.userId === user?.id);
  const canSubmit = why.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: WhyCardEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      why: why.trim(),
    };
    updateState({ ...state, cards: [...state.cards, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="why-title" className="text-xl font-bold text-rose-700 text-center">
        {config?.title ?? "我的為什麼"}
      </h2>
      <p data-testid="why-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "你為什麼在這裡？寫下讓你來到這裡的核心動力"}
      </p>
      <p data-testid="why-count" className="text-xs text-gray-400 text-center">
        已分享：{state.cards.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="why-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-rose-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊 Why
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="why-form" className="space-y-3 bg-rose-50 rounded-xl p-4">
          <div className="text-center text-4xl">❤️</div>
          <textarea
            data-testid="why-input"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="我來這裡是因為..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            data-testid="why-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享我的 Why
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="why-my-entry" className="p-4 rounded-xl border-2 bg-rose-50 border-rose-300">
          <p className="text-center text-2xl mb-2">❤️</p>
          <p className="text-sm text-rose-800 text-center italic">「{myEntry.why}」</p>
        </div>
      )}

      {state.revealed && state.cards.length === 0 && (
        <div data-testid="why-empty" className="text-center text-gray-400 py-8">還沒有人分享 Why</div>
      )}

      {state.revealed && state.cards.length > 0 && (
        <div data-testid="why-result" className="space-y-3">
          {state.cards.map((c, i) => (
            <div
              key={c.entryId}
              data-testid={`why-card-${c.entryId}`}
              className={`p-4 rounded-xl border-2 ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <p className="text-xs font-medium mb-2 opacity-60">{c.userName}</p>
              <p className="text-sm italic">「{c.why}」</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
