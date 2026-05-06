import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface RainbowBridgeEntry {
  entryId: string;
  userId: string;
  userName: string;
  colorPath: string;
  reflection: string;
}

interface RainbowBridgeState extends Record<string, unknown> {
  entries: RainbowBridgeEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: RainbowBridgeState = { entries: [], revealed: false };

const COLOR_PATHS = [
  { id: "red", label: "熱情", icon: "❤️", desc: "充滿能量的行動力", color: "red" },
  { id: "orange", label: "創意", icon: "🧡", desc: "突破框架的想像力", color: "orange" },
  { id: "yellow", label: "智慧", icon: "💛", desc: "照亮前路的洞察力", color: "yellow" },
  { id: "green", label: "成長", icon: "💚", desc: "向上延伸的生命力", color: "green" },
  { id: "blue", label: "平靜", icon: "💙", desc: "深如大海的包容力", color: "blue" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function RainbowBridge({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<RainbowBridgeState>({
    gameId,
    sessionId,
    pageId,
    type: "rainbow_bridge",
    defaultState: DEFAULT_STATE,
  });

  const [selectedColor, setSelectedColor] = useState("red");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="rnb-loading">載入中...</div>;

  const title = config?.title ?? "彩虹橋";
  const prompt = config?.prompt ?? "踏上彩虹橋，選擇最能代表你此刻的顏色";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: RainbowBridgeEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      colorPath: selectedColor,
      reflection: reflection.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setReflection("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="rnb-title" className="text-2xl font-bold text-pink-600">
        {title}
      </h2>
      <p data-testid="rnb-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="rnb-count" className="text-sm text-gray-500">
        已踏上 {state.entries.length} 道彩虹
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="rnb-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {COLOR_PATHS.map((cp) => (
              <button
                key={cp.id}
                data-testid={`rnb-color-${cp.id}`}
                onClick={() => setSelectedColor(cp.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedColor === cp.id
                    ? `border-${cp.color}-500 bg-${cp.color}-50 text-${cp.color}-700`
                    : "border-gray-200 hover:border-pink-300"
                }`}
              >
                <div className="text-xl">{cp.icon}</div>
                <div className="text-xs font-medium">{cp.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{cp.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="rnb-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="分享此刻的感受..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-pink-400 focus:outline-none"
          />
          <button
            data-testid="rnb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-pink-500 text-white font-semibold disabled:opacity-40"
          >
            踏上彩虹橋 🌈
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="rnb-my-entry" className="p-4 bg-pink-50 rounded-xl border border-pink-200 space-y-1">
          <p className="text-sm text-pink-600 font-medium">
            {COLOR_PATHS.find((c) => c.id === myEntry.colorPath)?.icon}{" "}
            {COLOR_PATHS.find((c) => c.id === myEntry.colorPath)?.label}
          </p>
          <p className="text-gray-700">{myEntry.reflection}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="rnb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-purple-500 text-white font-semibold"
        >
          揭曉所有彩虹 🌈
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="rnb-empty" className="text-center text-gray-400 py-8">
          彩虹橋尚無足跡
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="rnb-result" className="space-y-3">
          <h3 className="font-semibold text-pink-600">所有彩虹已揭曉</h3>
          {state.entries.map((entry) => {
            const cp = COLOR_PATHS.find((c) => c.id === entry.colorPath);
            return (
              <div
                key={entry.entryId}
                data-testid={`rnb-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-pink-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{cp?.icon}</span>
                  <span className="font-medium text-pink-600">{cp?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.reflection}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
