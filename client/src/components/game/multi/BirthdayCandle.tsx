import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface BirthdayCandleEntry {
  entryId: string;
  userId: string;
  userName: string;
  timeframe: string;
  wish: string;
}

interface BirthdayCandleState extends Record<string, unknown> {
  entries: BirthdayCandleEntry[];
  revealed: boolean;
}

interface BirthdayCandleConfig {
  title?: string;
  prompt?: string;
}

interface BirthdayCandleProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: BirthdayCandleConfig;
}

const TIMEFRAMES = [
  { id: "1year", label: "1 年內", icon: "🕯️" },
  { id: "3years", label: "3 年內", icon: "🕯️🕯️" },
  { id: "5years", label: "5 年內", icon: "🕯️🕯️🕯️" },
  { id: "forever", label: "永遠", icon: "✨" },
];

const CARD_COLORS = [
  "bg-yellow-50 border-yellow-200",
  "bg-amber-50 border-amber-200",
  "bg-orange-50 border-orange-200",
  "bg-red-50 border-red-200",
  "bg-pink-50 border-pink-200",
];

export function BirthdayCandle({ gameId, sessionId, pageId, isTeamLead, config }: BirthdayCandleProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<BirthdayCandleState>({
    gameId,
    sessionId,
    pageId,
    type: "birthday_candle",
    defaultState: { entries: [], revealed: false },
  });

  const [timeframe, setTimeframe] = useState("1year");
  const [wish, setWish] = useState("");

  if (!isLoaded) return <div data-testid="bcd-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = wish.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: BirthdayCandleEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "朋友",
      timeframe,
      wish: wish.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedTimeframe = TIMEFRAMES.find((t) => t.id === timeframe)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="bcd-title" className="text-xl font-bold text-yellow-700 text-center">
        {config?.title ?? "生日許願蠟燭"}
      </h2>
      <p data-testid="bcd-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "為壽星點燃一根蠟燭，許下你的祝願！"}
      </p>
      <p data-testid="bcd-count" className="text-xs text-gray-400 text-center">
        已許願：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="bcd-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium"
        >
          吹熄蠟燭，揭開祝願！
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="bcd-form" className="space-y-3 bg-yellow-50 rounded-xl p-4">
          <div data-testid="bcd-timeframe-grid" className="grid grid-cols-4 gap-2">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.id}
                data-testid={`bcd-timeframe-${t.id}`}
                onClick={() => setTimeframe(t.id)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-colors ${
                  timeframe === t.id
                    ? "bg-yellow-100 border-yellow-400"
                    : "bg-white border-gray-200 hover:border-yellow-200"
                }`}
              >
                <span className="text-lg">{t.icon}</span>
                <span className="text-xs text-gray-600 text-center">{t.label}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-yellow-700 font-medium mb-1">
              🎂 {selectedTimeframe.label}的祝願：
            </label>
            <textarea
              data-testid="bcd-wish-input"
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="許下你對壽星的祝願..."
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
            />
          </div>
          <button
            data-testid="bcd-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            點燃蠟燭 🕯️
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="bcd-my-entry" className="p-4 rounded-xl border-2 bg-yellow-50 border-yellow-300 space-y-1">
          <p className="text-sm font-medium text-yellow-700">
            {TIMEFRAMES.find((t) => t.id === myEntry.timeframe)?.icon}{" "}
            {TIMEFRAMES.find((t) => t.id === myEntry.timeframe)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.wish}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="bcd-empty" className="text-center text-gray-400 py-8">還沒有人許願</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="bcd-result" className="space-y-2">
          <p className="text-center text-yellow-600 text-sm font-medium">
            🎂 共 {state.entries.length} 個祝願
          </p>
          {state.entries.map((e, i) => {
            const tf = TIMEFRAMES.find((t) => t.id === e.timeframe);
            return (
              <div
                key={e.entryId}
                data-testid={`bcd-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-xs font-medium text-yellow-600 mb-1">{tf?.icon} {tf?.label}</p>
                <p className="text-sm text-gray-700 italic">「{e.wish}」</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
