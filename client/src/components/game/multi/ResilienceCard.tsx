import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ResilienceCardEntry {
  entryId: string;
  userId: string;
  userName: string;
  strategy: string;
  description: string;
}

interface ResilienceCardState extends Record<string, unknown> {
  cards: ResilienceCardEntry[];
  revealed: boolean;
}

interface ResilienceCardConfig {
  title?: string;
  prompt?: string;
}

interface ResilienceCardProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: ResilienceCardConfig;
}

const STRATEGIES = [
  { key: "reframe", label: "重新框架", icon: "🔄", desc: "換個角度看問題" },
  { key: "connect", label: "連結他人", icon: "🤝", desc: "向他人尋求支持" },
  { key: "pause", label: "暫停休息", icon: "⏸️", desc: "給自己充電空間" },
  { key: "action", label: "立即行動", icon: "⚡", desc: "用行動克服恐懼" },
  { key: "reflect", label: "深度反思", icon: "🪞", desc: "從中找到學習點" },
];

const CARD_COLORS = [
  "bg-indigo-50 border-indigo-300 text-indigo-800",
  "bg-sky-50 border-sky-300 text-sky-800",
  "bg-teal-50 border-teal-300 text-teal-800",
  "bg-violet-50 border-violet-300 text-violet-800",
  "bg-emerald-50 border-emerald-300 text-emerald-800",
];

export function ResilienceCard({ gameId, sessionId, pageId, isTeamLead, config }: ResilienceCardProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ResilienceCardState>({
    gameId,
    sessionId,
    pageId,
    type: "resilience_card",
    defaultState: { cards: [], revealed: false },
  });

  const [strategy, setStrategy] = useState("reframe");
  const [description, setDescription] = useState("");

  if (!isLoaded) return <div data-testid="rsc-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.cards.find((c) => c.userId === user?.id);
  const canSubmit = description.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: ResilienceCardEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      strategy,
      description: description.trim(),
    };
    updateState({ ...state, cards: [...state.cards, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="rsc-title" className="text-xl font-bold text-indigo-700 text-center">
        {config?.title ?? "韌性策略"}
      </h2>
      <p data-testid="rsc-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "遇到挫折時你如何反彈？分享你的韌性策略"}
      </p>
      <p data-testid="rsc-count" className="text-xs text-gray-400 text-center">
        已分享：{state.cards.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="rsc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊韌性策略
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="rsc-form" className="space-y-3 bg-indigo-50 rounded-xl p-4">
          <div data-testid="rsc-strategy-grid" className="space-y-2">
            {STRATEGIES.map((s) => (
              <button
                key={s.key}
                data-testid={`rsc-strategy-${s.key}`}
                onClick={() => setStrategy(s.key)}
                className={`w-full flex items-center gap-3 p-2 rounded-lg border-2 text-sm transition-all text-left ${
                  strategy === s.key
                    ? "bg-indigo-200 border-indigo-500 font-medium"
                    : "bg-white border-gray-200"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <span className="font-medium">{s.label}</span>
                <span className="text-gray-400 text-xs ml-auto">{s.desc}</span>
              </button>
            ))}
          </div>
          <textarea
            data-testid="rsc-description-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="具體描述你如何運用這個策略..."
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
          />
          <button
            data-testid="rsc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享韌性策略
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="rsc-my-entry" className="p-4 rounded-xl border-2 bg-indigo-100 border-indigo-400">
          <p className="font-bold text-sm">
            {STRATEGIES.find((s) => s.key === myEntry.strategy)?.icon}{" "}
            {STRATEGIES.find((s) => s.key === myEntry.strategy)?.label}
          </p>
          <p className="text-sm mt-1">{myEntry.description}</p>
        </div>
      )}

      {state.revealed && state.cards.length === 0 && (
        <div data-testid="rsc-empty" className="text-center text-gray-400 py-8">還沒有人分享韌性策略</div>
      )}

      {state.revealed && state.cards.length > 0 && (
        <div data-testid="rsc-result" className="space-y-2">
          {state.cards.map((c, i) => (
            <div
              key={c.entryId}
              data-testid={`rsc-card-${c.entryId}`}
              className={`p-3 rounded-xl border-2 ${CARD_COLORS[i % CARD_COLORS.length]}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{STRATEGIES.find((s) => s.key === c.strategy)?.icon}</span>
                <span className="font-medium text-sm">{c.userName}</span>
                <span className="text-xs opacity-60">· {STRATEGIES.find((s) => s.key === c.strategy)?.label}</span>
              </div>
              <p className="text-sm">{c.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
