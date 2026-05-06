import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface FireflyDanceEntry {
  entryId: string;
  userId: string;
  userName: string;
  lightPattern: string;
  glow: string;
}

interface FireflyDanceState extends Record<string, unknown> {
  entries: FireflyDanceEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: FireflyDanceState = { entries: [], revealed: false };

const LIGHT_PATTERNS = [
  { id: "solo_dance", label: "獨舞", icon: "✨", desc: "一點螢光，獨自閃耀" },
  { id: "group_dance", label: "群舞", icon: "🌟", desc: "萬螢共舞，光芒四射" },
  { id: "spiral_dance", label: "螺旋舞", icon: "🌀", desc: "旋轉飛舞，如夢似幻" },
  { id: "flash_dance", label: "閃爍舞", icon: "⚡", desc: "快閃快滅，驚鴻一瞥" },
  { id: "slow_dance", label: "慢舞", icon: "🌙", desc: "悠然輕舞，溫柔夜光" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function FireflyDance({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<FireflyDanceState>({
    gameId,
    sessionId,
    pageId,
    type: "firefly_dance",
    defaultState: DEFAULT_STATE,
  });

  const [selectedPattern, setSelectedPattern] = useState("solo_dance");
  const [glow, setGlow] = useState("");

  if (!isLoaded) return <div data-testid="ffd-loading">載入中...</div>;

  const title = config?.title ?? "螢火蟲之舞";
  const prompt = config?.prompt ?? "選一種舞姿，讓你的螢火蟲光芒在夜空中閃耀";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = glow.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: FireflyDanceEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      lightPattern: selectedPattern,
      glow: glow.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setGlow("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="ffd-title" className="text-2xl font-bold text-yellow-600">
        {title}
      </h2>
      <p data-testid="ffd-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="ffd-count" className="text-sm text-gray-500">
        已閃耀 {state.entries.length} 道光芒
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="ffd-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {LIGHT_PATTERNS.map((lp) => (
              <button
                key={lp.id}
                data-testid={`ffd-pattern-${lp.id}`}
                onClick={() => setSelectedPattern(lp.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedPattern === lp.id
                    ? "border-yellow-500 bg-yellow-50 text-yellow-700"
                    : "border-gray-200 hover:border-yellow-300"
                }`}
              >
                <div className="text-xl">{lp.icon}</div>
                <div className="text-xs font-medium">{lp.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{lp.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="ffd-glow-input"
            value={glow}
            onChange={(e) => setGlow(e.target.value)}
            placeholder="寫下你的螢火蟲想說的話..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-yellow-400 focus:outline-none"
          />
          <button
            data-testid="ffd-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-yellow-500 text-white font-semibold disabled:opacity-40"
          >
            點亮螢火 ✨
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="ffd-my-entry" className="p-4 bg-yellow-50 rounded-xl border border-yellow-200 space-y-1">
          <p className="text-sm text-yellow-600 font-medium">
            {LIGHT_PATTERNS.find((l) => l.id === myEntry.lightPattern)?.icon}{" "}
            {LIGHT_PATTERNS.find((l) => l.id === myEntry.lightPattern)?.label}
          </p>
          <p className="text-gray-700">{myEntry.glow}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="ffd-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-amber-600 text-white font-semibold"
        >
          揭曉所有光芒 ✨
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="ffd-empty" className="text-center text-gray-400 py-8">
          夜空中尚無螢火蟲
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="ffd-result" className="space-y-3">
          <h3 className="font-semibold text-yellow-600">所有光芒已揭曉</h3>
          {state.entries.map((entry) => {
            const lp = LIGHT_PATTERNS.find((l) => l.id === entry.lightPattern);
            return (
              <div
                key={entry.entryId}
                data-testid={`ffd-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-yellow-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{lp?.icon}</span>
                  <span className="font-medium text-yellow-700">{lp?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.glow}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
