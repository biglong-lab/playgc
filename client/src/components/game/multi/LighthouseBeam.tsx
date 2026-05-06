import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface LighthouseBeamEntry {
  entryId: string;
  userId: string;
  userName: string;
  beamDirection: string;
  guidance: string;
}

interface LighthouseBeamState extends Record<string, unknown> {
  entries: LighthouseBeamEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: LighthouseBeamState = { entries: [], revealed: false };

const BEAM_DIRECTIONS = [
  { id: "family", label: "家庭", icon: "🏠", desc: "家人給我的力量" },
  { id: "work", label: "工作", icon: "💼", desc: "事業帶給我方向" },
  { id: "learning", label: "學習", icon: "📖", desc: "知識為我照路" },
  { id: "health", label: "健康", icon: "💪", desc: "身心滋養我前行" },
  { id: "dream", label: "夢想", icon: "✨", desc: "夢想為我指引" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function LighthouseBeam({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<LighthouseBeamState>({
    gameId,
    sessionId,
    pageId,
    type: "lighthouse_beam",
    defaultState: DEFAULT_STATE,
  });

  const [selectedDirection, setSelectedDirection] = useState("family");
  const [guidance, setGuidance] = useState("");

  if (!isLoaded) return <div data-testid="lhb-loading">載入中...</div>;

  const title = config?.title ?? "燈塔光束";
  const prompt = config?.prompt ?? "你生命中的燈塔指向何方？分享照亮你前進的那道光";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = guidance.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: LighthouseBeamEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      beamDirection: selectedDirection,
      guidance: guidance.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setGuidance("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="lhb-title" className="text-2xl font-bold text-teal-700">
        {title}
      </h2>
      <p data-testid="lhb-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="lhb-count" className="text-sm text-gray-500">
        已點亮 {state.entries.length} 道光束
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="lhb-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {BEAM_DIRECTIONS.map((bd) => (
              <button
                key={bd.id}
                data-testid={`lhb-dir-${bd.id}`}
                onClick={() => setSelectedDirection(bd.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedDirection === bd.id
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-gray-200 hover:border-teal-300"
                }`}
              >
                <div className="text-xl">{bd.icon}</div>
                <div className="text-xs font-medium">{bd.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{bd.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="lhb-guidance-input"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            placeholder="分享你的引導之光..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-teal-400 focus:outline-none"
          />
          <button
            data-testid="lhb-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-teal-500 text-white font-semibold disabled:opacity-40"
          >
            點亮光束 🔦
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="lhb-my-entry" className="p-4 bg-teal-50 rounded-xl border border-teal-200 space-y-1">
          <p className="text-sm text-teal-600 font-medium">
            {BEAM_DIRECTIONS.find((b) => b.id === myEntry.beamDirection)?.icon}{" "}
            {BEAM_DIRECTIONS.find((b) => b.id === myEntry.beamDirection)?.label}
          </p>
          <p className="text-gray-700">{myEntry.guidance}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="lhb-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-blue-500 text-white font-semibold"
        >
          揭曉所有光束 🏮
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="lhb-empty" className="text-center text-gray-400 py-8">
          尚無燈塔點亮
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="lhb-result" className="space-y-3">
          <h3 className="font-semibold text-teal-700">所有光束已點亮</h3>
          {state.entries.map((entry) => {
            const bd = BEAM_DIRECTIONS.find((b) => b.id === entry.beamDirection);
            return (
              <div
                key={entry.entryId}
                data-testid={`lhb-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-teal-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{bd?.icon}</span>
                  <span className="font-medium text-teal-700">{bd?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.guidance}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
