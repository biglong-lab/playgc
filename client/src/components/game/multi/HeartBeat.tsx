import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface HeartBeatEntry {
  entryId: string;
  userId: string;
  userName: string;
  speed: string;
  reason: string;
}

interface HeartBeatState extends Record<string, unknown> {
  entries: HeartBeatEntry[];
  revealed: boolean;
}

interface HeartBeatConfig {
  title?: string;
  prompt?: string;
}

interface HeartBeatProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: HeartBeatConfig;
}

const SPEEDS = [
  { id: "racing", label: "飛速跳動", icon: "💓", desc: "充滿激情與活力" },
  { id: "steady", label: "穩定有力", icon: "❤️", desc: "踏實前行" },
  { id: "gentle", label: "輕柔跳動", icon: "🩷", desc: "平靜安詳" },
  { id: "slow", label: "緩慢深沉", icon: "💜", desc: "沉澱思考中" },
  { id: "skipping", label: "偶爾跳一下", icon: "🤍", desc: "需要能量補充" },
];

const CARD_COLORS = [
  "bg-rose-50 border-rose-200",
  "bg-pink-50 border-pink-200",
  "bg-red-50 border-red-200",
  "bg-orange-50 border-orange-200",
  "bg-fuchsia-50 border-fuchsia-200",
];

export function HeartBeat({ gameId, sessionId, pageId, isTeamLead, config }: HeartBeatProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<HeartBeatState>({
    gameId,
    sessionId,
    pageId,
    type: "heart_beat",
    defaultState: { entries: [], revealed: false },
  });

  const [speed, setSpeed] = useState("steady");
  const [reason, setReason] = useState("");

  if (!isLoaded) return <div data-testid="hbt-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = reason.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: HeartBeatEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      speed,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedSpeed = SPEEDS.find((s) => s.id === speed)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="hbt-title" className="text-xl font-bold text-rose-700 text-center">
        {config?.title ?? "心跳頻率"}
      </h2>
      <p data-testid="hbt-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "此刻，你的心跳是什麼節奏？"}
      </p>
      <p data-testid="hbt-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="hbt-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-rose-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊心跳
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="hbt-form" className="space-y-3 bg-rose-50 rounded-xl p-4">
          <div data-testid="hbt-speed-grid" className="grid grid-cols-1 gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s.id}
                data-testid={`hbt-speed-${s.id}`}
                onClick={() => setSpeed(s.id)}
                className={`flex items-center gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                  speed === s.id
                    ? "bg-rose-100 border-rose-400"
                    : "bg-white border-gray-200 hover:border-rose-200"
                }`}
              >
                <span className="text-xl">{s.icon}</span>
                <div>
                  <p className="text-sm font-medium text-gray-800">{s.label}</p>
                  <p className="text-xs text-gray-400">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-rose-700 font-medium mb-1">
              {selectedSpeed.icon} 因為...
            </label>
            <input
              data-testid="hbt-reason-input"
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="說說你為什麼是這個節奏？"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            data-testid="hbt-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            送出心跳
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="hbt-my-entry" className="p-4 rounded-xl border-2 bg-rose-50 border-rose-300 space-y-1">
          <p className="text-sm font-medium text-rose-700">
            {SPEEDS.find((s) => s.id === myEntry.speed)?.icon}{" "}
            {SPEEDS.find((s) => s.id === myEntry.speed)?.label}
          </p>
          <p className="text-xs text-gray-600">{myEntry.reason}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="hbt-empty" className="text-center text-gray-400 py-8">還沒有人完成心跳</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="hbt-result" className="space-y-2">
          {state.entries.map((e, i) => {
            const spd = SPEEDS.find((s) => s.id === e.speed);
            return (
              <div
                key={e.entryId}
                data-testid={`hbt-card-${e.entryId}`}
                className={`p-3 rounded-xl border ${CARD_COLORS[i % CARD_COLORS.length]}`}
              >
                <p className="text-xs font-medium text-gray-500 mb-1">{e.userName}</p>
                <p className="text-sm font-medium text-gray-700">{spd?.icon} {spd?.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{e.reason}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
