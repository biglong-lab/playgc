import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface ColorMoodEntry {
  entryId: string;
  userId: string;
  userName: string;
  color: string;
  note: string;
}

interface ColorMoodState extends Record<string, unknown> {
  entries: ColorMoodEntry[];
  revealed: boolean;
}

interface ColorMoodConfig {
  title?: string;
  prompt?: string;
}

interface ColorMoodProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: ColorMoodConfig;
}

const COLORS = [
  { id: "red", label: "熱情紅", hex: "#ef4444", bg: "bg-red-500", ring: "ring-red-400" },
  { id: "orange", label: "活力橙", hex: "#f97316", bg: "bg-orange-500", ring: "ring-orange-400" },
  { id: "yellow", label: "陽光黃", hex: "#eab308", bg: "bg-yellow-500", ring: "ring-yellow-400" },
  { id: "green", label: "生機綠", hex: "#22c55e", bg: "bg-green-500", ring: "ring-green-400" },
  { id: "blue", label: "沉靜藍", hex: "#3b82f6", bg: "bg-blue-500", ring: "ring-blue-400" },
  { id: "purple", label: "神秘紫", hex: "#a855f7", bg: "bg-purple-500", ring: "ring-purple-400" },
  { id: "pink", label: "溫柔粉", hex: "#ec4899", bg: "bg-pink-500", ring: "ring-pink-400" },
  { id: "gray", label: "靜謐灰", hex: "#6b7280", bg: "bg-gray-500", ring: "ring-gray-400" },
];

export function ColorMood({ gameId, sessionId, pageId, isTeamLead, config }: ColorMoodProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<ColorMoodState>({
    gameId,
    sessionId,
    pageId,
    type: "color_mood",
    defaultState: { entries: [], revealed: false },
  });

  const [color, setColor] = useState("blue");
  const [note, setNote] = useState("");

  if (!isLoaded) return <div data-testid="cmd-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = note.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: ColorMoodEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      color,
      note: note.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  const selectedColor = COLORS.find((c) => c.id === color)!;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="cmd-title" className="text-xl font-bold text-blue-700 text-center">
        {config?.title ?? "今日色彩心情"}
      </h2>
      <p data-testid="cmd-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "如果今天的心情是一種顏色，你會選哪個？"}
      </p>
      <p data-testid="cmd-count" className="text-xs text-gray-400 text-center">
        已完成：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="cmd-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊色彩
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="cmd-form" className="space-y-3 bg-blue-50 rounded-xl p-4">
          <div data-testid="cmd-color-grid" className="grid grid-cols-4 gap-3">
            {COLORS.map((c) => (
              <button
                key={c.id}
                data-testid={`cmd-color-${c.id}`}
                onClick={() => setColor(c.id)}
                className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${
                  color === c.id ? "border-gray-400 scale-105" : "border-transparent"
                }`}
              >
                <div className={`w-10 h-10 rounded-full ${c.bg} ${color === c.id ? `ring-2 ring-offset-1 ${c.ring}` : ""}`} />
                <span className="text-xs text-gray-600">{c.label}</span>
              </button>
            ))}
          </div>
          <div>
            <label className="block text-xs text-blue-700 font-medium mb-1">
              為什麼是{selectedColor.label}？
            </label>
            <input
              data-testid="cmd-note-input"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="說說這個顏色代表你的感受..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <button
            data-testid="cmd-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            送出心情色彩
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="cmd-my-entry" className="p-4 rounded-xl border-2 bg-blue-50 border-blue-300 space-y-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-6 h-6 rounded-full ${COLORS.find((c) => c.id === myEntry.color)?.bg}`}
            />
            <p className="text-sm font-medium text-blue-700">
              {COLORS.find((c) => c.id === myEntry.color)?.label}
            </p>
          </div>
          <p className="text-xs text-gray-600">{myEntry.note}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="cmd-empty" className="text-center text-gray-400 py-8">還沒有人選擇心情色彩</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="cmd-result" className="grid grid-cols-2 gap-2">
          {state.entries.map((e) => {
            const clr = COLORS.find((c) => c.id === e.color);
            return (
              <div
                key={e.entryId}
                data-testid={`cmd-card-${e.entryId}`}
                className="p-3 rounded-xl border border-gray-200 bg-white space-y-1"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-5 h-5 rounded-full ${clr?.bg}`} />
                  <p className="text-xs font-medium text-gray-700">{clr?.label}</p>
                </div>
                <p className="text-xs font-medium text-gray-500">{e.userName}</p>
                <p className="text-xs text-gray-400">{e.note}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
