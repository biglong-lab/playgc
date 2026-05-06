import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface TidePoolEntry {
  entryId: string;
  userId: string;
  userName: string;
  creature: string;
  reflection: string;
}

interface TidePoolState extends Record<string, unknown> {
  entries: TidePoolEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: TidePoolState = { entries: [], revealed: false };

const CREATURES = [
  { id: "starfish", label: "海星", icon: "⭐", desc: "靜靜等待的觀察者" },
  { id: "crab", label: "螃蟹", icon: "🦀", desc: "橫行霸道的行動家" },
  { id: "anemone", label: "海葵", icon: "🌸", desc: "隨浪搖曳的夢想家" },
  { id: "hermit_crab", label: "寄居蟹", icon: "🐚", desc: "攜家帶殼的旅行者" },
  { id: "fish", label: "小魚", icon: "🐟", desc: "穿梭其間的連結者" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function TidePool({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<TidePoolState>({
    gameId,
    sessionId,
    pageId,
    type: "tide_pool",
    defaultState: DEFAULT_STATE,
  });

  const [selectedCreature, setSelectedCreature] = useState("starfish");
  const [reflection, setReflection] = useState("");

  if (!isLoaded) return <div data-testid="tdp-loading">載入中...</div>;

  const title = config?.title ?? "潮池";
  const prompt = config?.prompt ?? "你是潮池中的哪種生物？分享你在這個團隊中的角色";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = reflection.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: TidePoolEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      creature: selectedCreature,
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
      <h2 data-testid="tdp-title" className="text-2xl font-bold text-teal-700">
        {title}
      </h2>
      <p data-testid="tdp-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="tdp-count" className="text-sm text-gray-500">
        已加入 {state.entries.length} 種生物
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="tdp-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {CREATURES.map((c) => (
              <button
                key={c.id}
                data-testid={`tdp-creature-${c.id}`}
                onClick={() => setSelectedCreature(c.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedCreature === c.id
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-gray-200 hover:border-teal-300"
                }`}
              >
                <div className="text-xl">{c.icon}</div>
                <div className="text-xs font-medium">{c.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{c.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="tdp-reflection-input"
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
            placeholder="描述你在團隊中的樣子..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-teal-400 focus:outline-none"
          />
          <button
            data-testid="tdp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-teal-500 text-white font-semibold disabled:opacity-40"
          >
            加入潮池 🌊
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="tdp-my-entry" className="p-4 bg-teal-50 rounded-xl border border-teal-200 space-y-1">
          <p className="text-sm text-teal-600 font-medium">
            {CREATURES.find((c) => c.id === myEntry.creature)?.icon}{" "}
            {CREATURES.find((c) => c.id === myEntry.creature)?.label}
          </p>
          <p className="text-gray-700">{myEntry.reflection}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="tdp-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-cyan-600 text-white font-semibold"
        >
          揭曉所有生物 🌊
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="tdp-empty" className="text-center text-gray-400 py-8">
          潮池中空無一物
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="tdp-result" className="space-y-3">
          <h3 className="font-semibold text-teal-700">潮池生態揭曉</h3>
          {state.entries.map((entry) => {
            const c = CREATURES.find((cr) => cr.id === entry.creature);
            return (
              <div
                key={entry.entryId}
                data-testid={`tdp-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-teal-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{c?.icon}</span>
                  <span className="font-medium text-teal-700">{c?.label}</span>
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
