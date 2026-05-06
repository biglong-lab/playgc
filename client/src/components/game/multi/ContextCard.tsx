import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ContextCardEntry {
  entryId: string;
  userId: string;
  userName: string;
  signal: string;
  context: string;
}

interface ContextCardState extends Record<string, unknown> {
  entries: ContextCardEntry[];
  revealed: boolean;
}

interface ContextCardConfig {
  title?: string;
  prompt?: string;
}

interface ContextCardProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: ContextCardConfig;
}

const SIGNALS = [
  { id: "green", label: "綠燈", icon: "🟢", desc: "狀態良好，準備好了", color: "bg-green-100 border-green-400" },
  { id: "yellow", label: "黃燈", icon: "🟡", desc: "有些事在我心裡", color: "bg-yellow-100 border-yellow-400" },
  { id: "red", label: "紅燈", icon: "🔴", desc: "需要一點時間調整", color: "bg-red-100 border-red-400" },
];

const CARD_COLORS = [
  "bg-green-50 border-green-200",
  "bg-yellow-50 border-yellow-200",
  "bg-red-50 border-red-200",
  "bg-teal-50 border-teal-200",
  "bg-orange-50 border-orange-200",
];

export function ContextCard({ gameId, sessionId, pageId, isTeamLead, config }: ContextCardProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ContextCardState>({
    gameId,
    sessionId,
    pageId,
    type: "context_card",
    defaultState: { entries: [], revealed: false },
  });

  const [signal, setSignal] = useState("green");
  const [context, setContext] = useState("");

  if (!isLoaded) return <div data-testid="cxt-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = context.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: ContextCardEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      signal,
      context: context.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedSignal = SIGNALS.find((s) => s.id === signal)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="cxt-title" className="text-xl font-bold text-gray-700 text-center">
        {config?.title ?? "會前脈絡卡"}
      </h2>
      <p data-testid="cxt-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "在開始之前，讓大家知道你今天來自什麼狀態。"}
      </p>
      <p data-testid="cxt-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cxt-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-gray-700 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊狀態
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="cxt-form" className="space-y-3 bg-gray-50 rounded-xl p-4">
          <div data-testid="cxt-signal-grid" className="grid grid-cols-3 gap-2">
            {SIGNALS.map((s) => (
              <button
                key={s.id}
                data-testid={`cxt-signal-${s.id}`}
                onClick={() => setSignal(s.id)}
                className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors ${
                  signal === s.id ? s.color : "bg-white border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">{s.icon}</span>
                <p className="text-xs font-bold text-gray-700">{s.label}</p>
                <p className="text-xs text-gray-400 text-center">{s.desc}</p>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-gray-600 font-medium mb-1">
              {selectedSignal.icon} 說說你的狀態...
            </label>
            <textarea
              data-testid="cxt-context-input"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="例如：剛剛開完一個長會，需要切換一下心情..."
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <button
            data-testid="cxt-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-gray-700 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享狀態
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="cxt-my-entry" className="p-4 rounded-xl border-2 bg-gray-50 border-gray-300 space-y-1">
          <p className="text-sm font-medium text-gray-700">
            {SIGNALS.find((s) => s.id === myEntry.signal)?.icon}{" "}
            {SIGNALS.find((s) => s.id === myEntry.signal)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.context}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="cxt-empty" className="text-center text-gray-400 py-8">還沒有人分享狀態</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="cxt-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const sig = SIGNALS.find((s) => s.id === e.signal);
            return (
              <div
                key={e.entryId}
                data-testid={`cxt-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{sig?.icon} {sig?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.context}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
