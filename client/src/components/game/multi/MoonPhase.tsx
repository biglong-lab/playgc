import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface MoonPhaseEntry {
  entryId: string;
  userId: string;
  userName: string;
  phase: string;
  reason: string;
}

interface MoonPhaseState extends Record<string, unknown> {
  entries: MoonPhaseEntry[];
  revealed: boolean;
}

interface MoonPhaseConfig {
  title?: string;
  prompt?: string;
}

interface MoonPhaseProps {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: MoonPhaseConfig;
}

const PHASES = [
  { key: "new", label: "新月", icon: "🌑", desc: "新的開始，充滿可能" },
  { key: "waxing", label: "上弦月", icon: "🌓", desc: "成長中，蓄積能量" },
  { key: "full", label: "滿月", icon: "🌕", desc: "最高峰，光芒四射" },
  { key: "waning", label: "下弦月", icon: "🌗", desc: "收斂整合，沉澱智慧" },
  { key: "dark", label: "暗月", icon: "🌘", desc: "休養生息，等待時機" },
];

const PHASE_COLORS: Record<string, string> = {
  new: "bg-slate-100 border-slate-400",
  waxing: "bg-blue-100 border-blue-400",
  full: "bg-yellow-100 border-yellow-500",
  waning: "bg-purple-100 border-purple-400",
  dark: "bg-gray-100 border-gray-400",
};

export function MoonPhase({ gameId, sessionId, pageId, isTeamLead, config }: MoonPhaseProps) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<MoonPhaseState>({
    gameId,
    sessionId,
    pageId,
    type: "moon_phase",
    defaultState: { entries: [], revealed: false },
  });

  const [phase, setPhase] = useState("full");
  const [reason, setReason] = useState("");

  if (!isLoaded) return <div data-testid="mnp-loading" className="flex justify-center p-8"><div className="animate-spin w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full" /></div>;

  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = reason.trim().length >= 3;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: MoonPhaseEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "玩家",
      phase,
      reason: reason.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h2 data-testid="mnp-title" className="text-xl font-bold text-slate-700 text-center">
        {config?.title ?? "月相心情"}
      </h2>
      <p data-testid="mnp-prompt" className="text-sm text-gray-500 text-center">
        {config?.prompt ?? "哪個月相最能描述你現在的狀態？選一個並說說原因"}
      </p>
      <p data-testid="mnp-count" className="text-xs text-gray-400 text-center">
        已分享：{state.entries.length} 人
      </p>

      {isTeamLead && !state.revealed && (
        <button
          data-testid="mnp-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 bg-slate-700 text-white rounded-lg text-sm font-medium"
        >
          揭曉全隊月相
        </button>
      )}

      {!myEntry && !state.revealed && (
        <div data-testid="mnp-form" className="space-y-3 bg-slate-50 rounded-xl p-4">
          <div data-testid="mnp-phase-grid" className="grid grid-cols-5 gap-2">
            {PHASES.map((p) => (
              <button
                key={p.key}
                data-testid={`mnp-phase-${p.key}`}
                onClick={() => setPhase(p.key)}
                className={`flex flex-col items-center py-2 px-1 rounded-lg border-2 text-xs transition-all ${
                  phase === p.key
                    ? `${PHASE_COLORS[p.key]} border-2`
                    : "bg-white border-gray-200"
                }`}
              >
                <span className="text-2xl">{p.icon}</span>
                <span className="font-medium mt-1">{p.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-center text-gray-400 italic">
            {PHASES.find((p) => p.key === phase)?.desc}
          </p>
          <input
            data-testid="mnp-reason-input"
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="為什麼這個月相代表你現在？"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            data-testid="mnp-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 bg-slate-700 text-white rounded-lg text-sm font-medium disabled:opacity-40"
          >
            分享月相
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="mnp-my-entry" className={`p-4 rounded-xl border-2 ${PHASE_COLORS[myEntry.phase] ?? "bg-gray-100 border-gray-300"}`}>
          <p className="text-center text-3xl">{PHASES.find((p) => p.key === myEntry.phase)?.icon}</p>
          <p className="text-center font-bold text-sm mt-1">{PHASES.find((p) => p.key === myEntry.phase)?.label}</p>
          <p className="text-xs text-center mt-1 text-gray-600">{myEntry.reason}</p>
        </div>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="mnp-empty" className="text-center text-gray-400 py-8">還沒有人分享月相</div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="mnp-result" className="grid grid-cols-2 gap-3">
          {state.entries.map((e) => (
            <div
              key={e.entryId}
              data-testid={`mnp-card-${e.entryId}`}
              className={`p-3 rounded-xl border-2 text-center ${PHASE_COLORS[e.phase] ?? "bg-gray-100 border-gray-300"}`}
            >
              <p className="text-2xl">{PHASES.find((p) => p.key === e.phase)?.icon}</p>
              <p className="text-xs font-medium mt-1">{e.userName}</p>
              <p className="text-xs opacity-70">{PHASES.find((p) => p.key === e.phase)?.label}</p>
              <p className="text-xs mt-1 text-gray-500">{e.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
