import { useState } from "react";
import { useTeamPagePersistence } from "../shared/hooks/useTeamPagePersistence";
import { useAuth } from "@/hooks/useAuth";

interface DrumCircleEntry {
  entryId: string;
  userId: string;
  userName: string;
  rhythmType: string;
  beat: string;
}

interface DrumCircleState extends Record<string, unknown> {
  entries: DrumCircleEntry[];
  revealed: boolean;
}

const DEFAULT_STATE: DrumCircleState = { entries: [], revealed: false };

const RHYTHM_TYPES = [
  { id: "steady", label: "穩健", icon: "🥁", desc: "踏實前進的節拍" },
  { id: "upbeat", label: "活力", icon: "🎺", desc: "充滿朝氣的快節奏" },
  { id: "gentle", label: "輕柔", icon: "🎵", desc: "溫柔流動的低鳴" },
  { id: "powerful", label: "有力", icon: "💥", desc: "震撼人心的強音" },
  { id: "joyful", label: "歡快", icon: "🎶", desc: "令人雀躍的歡樂旋律" },
];

interface Props {
  gameId: string;
  sessionId: string;
  pageId: string;
  isTeamLead?: boolean;
  config?: { title?: string; prompt?: string };
}

export function DrumCircle({ gameId, sessionId, pageId, isTeamLead, config }: Props) {
  const { user } = useAuth();
  const { state, updateState, isLoaded } = useTeamPagePersistence<DrumCircleState>({
    gameId,
    sessionId,
    pageId,
    type: "drum_circle",
    defaultState: DEFAULT_STATE,
  });

  const [selectedRhythm, setSelectedRhythm] = useState("steady");
  const [beat, setBeat] = useState("");

  if (!isLoaded) return <div data-testid="drc-loading">載入中...</div>;

  const title = config?.title ?? "鼓圈節奏";
  const prompt = config?.prompt ?? "加入鼓圈，選擇你今天的節奏，敲出你的心聲";
  const myEntry = state.entries.find((e) => e.userId === user?.id);
  const canSubmit = beat.trim().length >= 5;

  function handleSubmit() {
    if (!canSubmit || !user) return;
    const entry: DrumCircleEntry = {
      entryId: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.firstName ?? user.email ?? "",
      rhythmType: selectedRhythm,
      beat: beat.trim(),
    };
    updateState({ ...state, entries: [...state.entries, entry] });
    setBeat("");
  }

  function handleReveal() {
    updateState({ ...state, revealed: true });
  }

  return (
    <div className="p-4 space-y-4">
      <h2 data-testid="drc-title" className="text-2xl font-bold text-red-700">
        {title}
      </h2>
      <p data-testid="drc-prompt" className="text-gray-600">
        {prompt}
      </p>
      <p data-testid="drc-count" className="text-sm text-gray-500">
        已加入 {state.entries.length} 人擊鼓
      </p>

      {!myEntry && !state.revealed && (
        <div data-testid="drc-form" className="space-y-3">
          <div className="grid grid-cols-5 gap-2">
            {RHYTHM_TYPES.map((rt) => (
              <button
                key={rt.id}
                data-testid={`drc-rhythm-${rt.id}`}
                onClick={() => setSelectedRhythm(rt.id)}
                className={`p-2 rounded-lg border text-center transition-colors ${
                  selectedRhythm === rt.id
                    ? "border-red-500 bg-red-50 text-red-700"
                    : "border-gray-200 hover:border-red-300"
                }`}
              >
                <div className="text-xl">{rt.icon}</div>
                <div className="text-xs font-medium">{rt.label}</div>
                <div className="text-xs text-gray-500 hidden sm:block">{rt.desc}</div>
              </button>
            ))}
          </div>
          <textarea
            data-testid="drc-beat-input"
            value={beat}
            onChange={(e) => setBeat(e.target.value)}
            placeholder="敲出你的心聲..."
            className="w-full border rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-red-400 focus:outline-none"
          />
          <button
            data-testid="drc-submit-btn"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full py-2 rounded-lg bg-red-500 text-white font-semibold disabled:opacity-40"
          >
            加入鼓圈 🥁
          </button>
        </div>
      )}

      {myEntry && !state.revealed && (
        <div data-testid="drc-my-entry" className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-1">
          <p className="text-sm text-red-600 font-medium">
            {RHYTHM_TYPES.find((r) => r.id === myEntry.rhythmType)?.icon}{" "}
            {RHYTHM_TYPES.find((r) => r.id === myEntry.rhythmType)?.label}
          </p>
          <p className="text-gray-700">{myEntry.beat}</p>
          <p className="text-xs text-gray-400">等待揭曉中...</p>
        </div>
      )}

      {isTeamLead && !state.revealed && (
        <button
          data-testid="drc-reveal-btn"
          onClick={handleReveal}
          className="w-full py-2 rounded-lg bg-orange-600 text-white font-semibold"
        >
          揭曉所有節奏 🎶
        </button>
      )}

      {state.revealed && state.entries.length === 0 && (
        <div data-testid="drc-empty" className="text-center text-gray-400 py-8">
          鼓圈尚無人加入
        </div>
      )}

      {state.revealed && state.entries.length > 0 && (
        <div data-testid="drc-result" className="space-y-3">
          <h3 className="font-semibold text-red-700">所有節奏已揭曉</h3>
          {state.entries.map((entry) => {
            const rt = RHYTHM_TYPES.find((r) => r.id === entry.rhythmType);
            return (
              <div
                key={entry.entryId}
                data-testid={`drc-card-${entry.entryId}`}
                className="p-3 bg-white rounded-lg border border-red-100 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{rt?.icon}</span>
                  <span className="font-medium text-red-700">{rt?.label}</span>
                  <span className="text-xs text-gray-400 ml-auto">{entry.userName}</span>
                </div>
                <p className="text-gray-700">{entry.beat}</p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
